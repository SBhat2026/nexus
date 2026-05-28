import { PCA } from 'ml-pca'
import { UMAP } from 'umap-js'
import clustering from 'density-clustering'
import { centroid, cosineSim, cosineDistance } from './dbscan'

function l2normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
  return v.map((x) => x / norm)
}

function seededRng(seed = 42) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

export interface ClusterMeta {
  clusterIndex: number
  memberIndices: number[]
  center: number[]  // centroid in L2-normalized embedding space
}

export interface PipelineResult {
  assignments: number[]
  outlierFlags: boolean[]
  clusters: ClusterMeta[]
  outlierDistances: number[]
  nearestClusterIndex: number[]
  /** Mean pairwise cosine similarity within each cluster (0–1). */
  clusterQuality: Record<number, number>
  /** PCA-reduced vectors (n × ≤100) — reuse as input to 2D UMAP for visualization. */
  pcaOut: number[][]
}

export function runClusteringPipeline(vectors: number[][]): PipelineResult {
  const n = vectors.length
  const assignments = new Array<number>(n).fill(-1)
  const outlierDistances = new Array<number>(n).fill(0)
  const nearestClusterIndex = new Array<number>(n).fill(-1)

  if (n < 3) {
    return {
      assignments,
      outlierFlags: new Array(n).fill(true),
      clusters: [],
      outlierDistances,
      nearestClusterIndex,
      clusterQuality: {},
      pcaOut: vectors,
    }
  }

  // 1. L2 normalize
  const normalized = vectors.map(l2normalize)

  // 2. PCA: reduce to min(100, n-1) components before UMAP
  const nPCA = Math.min(100, n - 1)
  const pca = new PCA(normalized, { center: true, scale: false })
  const pcaOut: number[][] = pca.predict(normalized, { nComponents: nPCA }).to2DArray()

  // 3. UMAP 15D on PCA output — captures manifold structure for clustering
  const nNeighbors = Math.min(15, n - 1)
  const umap = new UMAP({ nNeighbors, minDist: 0.1, nComponents: 15, random: seededRng(42) })
  const umapOut: number[][] = umap.fit(pcaOut) as number[][]

  // 4. DBSCAN on UMAP output — density-clustering uses Euclidean by default
  const dbscan = new clustering.DBSCAN()
  const minPts = Math.max(3, Math.ceil(n / 20))
  // Adaptive epsilon: 90th percentile of 4th-nearest-neighbor distances, clamped [0.4, 1.2]
  const knnDists = umapOut.map((pt, i) =>
    umapOut
      .map((other, j) => j === i ? Infinity : Math.sqrt(other.reduce((s, v, d) => s + (v - pt[d]) ** 2, 0)))
      .sort((a, b) => a - b)[3]
  ).sort((a, b) => a - b)
  const p90 = knnDists[Math.floor(knnDists.length * 0.9)]
  const epsilon = Math.min(1.2, Math.max(0.4, p90))
  console.log(`[clustering] adaptive epsilon: ${epsilon.toFixed(3)} (n=${n}, minPts=${minPts})`)
  const rawClusters: number[][] = dbscan.run(umapOut, epsilon, minPts) as number[][]
  const noise: number[] = dbscan.noise as number[]

  // Merge micro-clusters (< minPts) into nearest large cluster by UMAP centroid distance
  const largeClusters: number[][] = []
  const smallMembers: number[] = []
  for (const m of rawClusters) {
    if (m.length >= minPts) largeClusters.push(m)
    else for (const idx of m) smallMembers.push(idx)
  }
  if (largeClusters.length > 0 && smallMembers.length > 0) {
    const dim = umapOut[0].length
    const centroids = largeClusters.map((m) => {
      const c = new Array(dim).fill(0)
      for (const i of m) umapOut[i].forEach((v, j) => { c[j] += v })
      return c.map((v) => v / m.length)
    })
    for (const i of smallMembers) {
      let best = 0, bestD = Infinity
      centroids.forEach((c, ci) => {
        const d = umapOut[i].reduce((s, v, j) => s + (v - c[j]) ** 2, 0)
        if (d < bestD) { bestD = d; best = ci }
      })
      largeClusters[best].push(i)
    }
  }
  const finalClusters = largeClusters.length > 0 ? largeClusters : rawClusters

  // 5. Cluster metas — centroid computed in L2-normalized embedding space
  const clusterMetas: ClusterMeta[] = finalClusters.map((members, i) => ({
    clusterIndex: i,
    memberIndices: members,
    center: centroid(normalized, members),
  }))

  finalClusters.forEach((members, clusterIdx) => {
    members.forEach((pointIdx) => { assignments[pointIdx] = clusterIdx })
  })

  // 6. Outlier flags = DBSCAN noise only (no Isolation Forest)
  const noiseSet = new Set(noise)
  const outlierFlags = vectors.map((_, i) => noiseSet.has(i))

  // 7. Cluster quality = sampled mean cosine similarity (30 pairs, O(1) vs O(n²))
  const clusterQuality: Record<number, number> = {}
  const SAMPLES = 30
  clusterMetas.forEach((c) => {
    const vecs = c.memberIndices.map((i) => normalized[i])
    if (vecs.length < 2) { clusterQuality[c.clusterIndex] = 1.0; return }
    let sum = 0
    for (let k = 0; k < SAMPLES; k++) {
      const a = Math.floor(Math.random() * vecs.length)
      let b = Math.floor(Math.random() * vecs.length)
      if (b === a) b = (b + 1) % vecs.length
      sum += cosineSim(vecs[a], vecs[b])
    }
    clusterQuality[c.clusterIndex] = parseFloat((sum / SAMPLES).toFixed(3))
  })

  // 8. For each outlier, find nearest cluster centroid
  if (clusterMetas.length > 0) {
    normalized.forEach((normVec, i) => {
      if (!outlierFlags[i]) return
      let minDist = Infinity, minCluster = 0
      clusterMetas.forEach((c) => {
        const d = cosineDistance(normVec, c.center)
        if (d < minDist) { minDist = d; minCluster = c.clusterIndex }
      })
      outlierDistances[i] = parseFloat(minDist.toFixed(3))
      nearestClusterIndex[i] = minCluster
    })
  }

  return { assignments, outlierFlags, clusters: clusterMetas, outlierDistances, nearestClusterIndex, clusterQuality, pcaOut }
}
