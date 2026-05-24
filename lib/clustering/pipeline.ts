import { runDBSCAN, centroid } from './dbscan'
import { detectOutliers, distanceToCentroid } from './isolationForest'

export interface ClusterMeta {
  clusterIndex: number
  memberIndices: number[]
  center: number[]
}

export interface PipelineResult {
  /** Per-paper cluster index (-1 = noise/outlier) */
  assignments: number[]
  /** Per-paper outlier flag */
  outlierFlags: boolean[]
  /** Cluster metadata including centroid vectors */
  clusters: ClusterMeta[]
  /** For each outlier: distance to nearest cluster centroid */
  outlierDistances: number[]
  /** For each outlier: which cluster index is nearest */
  nearestClusterIndex: number[]
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
    }
  }

  const { clusters: rawClusters, noise } = runDBSCAN(vectors)

  // Map cluster indices
  const clusterMetas: ClusterMeta[] = rawClusters.map((members, i) => ({
    clusterIndex: i,
    memberIndices: members,
    center: centroid(vectors, members),
  }))

  rawClusters.forEach((members, clusterIdx) => {
    members.forEach((pointIdx) => { assignments[pointIdx] = clusterIdx })
  })

  // Run Isolation Forest on all vectors to find structural outliers
  const isoFlags = detectOutliers(vectors)

  // Combine: outlier = (DBSCAN noise) OR (Isolation Forest flag)
  const outlierFlags = vectors.map((_, i) =>
    noise.includes(i) || isoFlags[i]
  )

  // For each outlier, find nearest cluster centroid
  if (clusterMetas.length > 0) {
    vectors.forEach((vec, i) => {
      if (!outlierFlags[i]) return
      let minDist = Infinity
      let minCluster = 0
      clusterMetas.forEach((c) => {
        const d = distanceToCentroid(vec, c.center)
        if (d < minDist) { minDist = d; minCluster = c.clusterIndex }
      })
      outlierDistances[i] = parseFloat(minDist.toFixed(3))
      nearestClusterIndex[i] = minCluster
    })
  }

  return { assignments, outlierFlags, clusters: clusterMetas, outlierDistances, nearestClusterIndex }
}
