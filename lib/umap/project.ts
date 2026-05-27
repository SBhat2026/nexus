import { UMAP } from 'umap-js'

// Seeded LCG so same embeddings always yield the same layout
function makeRng(seed = 42) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function normalize(coords: number[][]): [number, number][] {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of coords) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  return coords.map(([x, y]) => [(x - minX) / rangeX, (y - minY) / rangeY])
}

/**
 * Project high-dim vectors to 2D using UMAP.
 * Returns coords normalized to [0,1]×[0,1].
 * For n<5 (too few for UMAP), returns points arranged on a circle.
 */
export function projectEmbeddings(vectors: number[][]): [number, number][] {
  const n = vectors.length
  if (n === 0) return []

  if (n < 5) {
    // Fallback: circle arrangement
    return vectors.map((_, i) => [
      0.5 + 0.4 * Math.cos((2 * Math.PI * i) / n),
      0.5 + 0.4 * Math.sin((2 * Math.PI * i) / n),
    ])
  }

  const nNeighbors = Math.min(15, n - 1)
  const umap = new UMAP({
    nNeighbors,
    minDist: 0.1,
    nComponents: 2,
    random: makeRng(42),
  })

  const raw = umap.fit(vectors)
  return normalize(raw as number[][])
}
