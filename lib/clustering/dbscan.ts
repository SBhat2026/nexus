import clustering from 'density-clustering'

export function cosineDistance(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 1
  return 1 - dot / denom
}

export interface DBSCANResult {
  clusters: number[][]   // each cluster = array of point indices
  noise: number[]        // indices of noise points (not in any cluster)
}

/**
 * Run DBSCAN with cosine distance on 768-dim SPECTER2 vectors.
 * eps=0.15 ≈ cosine distance threshold; minPts=3 minimum cluster size.
 */
export function runDBSCAN(
  vectors: number[][],
  eps = 0.15,
  minPts = 3
): DBSCANResult {
  const dbscan = new clustering.DBSCAN()
  const clusters = dbscan.run(vectors, eps, minPts, cosineDistance) as number[][]
  return { clusters, noise: dbscan.noise as number[] }
}

/** Compute centroid of a set of vectors by index. */
export function centroid(vectors: number[][], indices: number[]): number[] {
  const dim = vectors[0].length
  const sum = new Array<number>(dim).fill(0)
  for (const i of indices) {
    for (let d = 0; d < dim; d++) sum[d] += vectors[i][d]
  }
  return sum.map((v) => v / indices.length)
}

/** Cosine similarity (0-1). */
export function cosineSim(a: number[], b: number[]): number {
  return 1 - cosineDistance(a, b)
}
