// Lightweight fuzzy string matching for paper-title verification. Sørensen–Dice
// coefficient over character bigrams — robust to minor wording/spacing differences
// while still requiring genuine overlap (≈0.8 ≈ "the same title").

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>()
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2)
    m.set(bg, (m.get(bg) ?? 0) + 1)
  }
  return m
}

/** Dice similarity in [0, 1]. 1 = identical (after normalization). */
export function titleSimilarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.length < 2 || nb.length < 2) return na === nb ? 1 : 0
  const ba = bigrams(na)
  const bb = bigrams(nb)
  let intersection = 0
  for (const [bg, count] of ba) {
    const other = bb.get(bg)
    if (other) intersection += Math.min(count, other)
  }
  const total = (na.length - 1) + (nb.length - 1)
  return (2 * intersection) / total
}

/** Best similarity of `query` against any candidate. */
export function bestTitleSimilarity(query: string, candidates: string[]): number {
  let best = 0
  for (const c of candidates) {
    const s = titleSimilarity(query, c)
    if (s > best) best = s
    if (best === 1) break
  }
  return best
}
