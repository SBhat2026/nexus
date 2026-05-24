import { IsolationForest } from 'ml-isolation-forest'

/**
 * Run Isolation Forest on paper embedding vectors.
 * Returns boolean[] where true = outlier.
 * anomaly scores > threshold are flagged.
 */
export function detectOutliers(vectors: number[][], threshold = 0.55): boolean[] {
  if (vectors.length < 4) return vectors.map(() => false)

  const forest = new IsolationForest({ nEstimators: 100 })
  forest.train(vectors)
  const scores: number[] = forest.predict(vectors)

  return scores.map((s) => s > threshold)
}

/**
 * Mahalanobis-style distance from a point to a cluster centroid.
 * Using cosine distance since SPECTER2 is normalized.
 */
export function distanceToCentroid(vector: number[], centroid: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < vector.length; i++) {
    dot += vector[i] * centroid[i]
    normA += vector[i] * vector[i]
    normB += centroid[i] * centroid[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 1
  return 1 - dot / denom
}
