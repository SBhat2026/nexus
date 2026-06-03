/**
 * Deterministic, specificity-aware query planner for academic search.
 *
 * Problem this solves: the old path asked an LLM to always split any prompt into
 * exactly four queries (core / application / synonym / "adjacent subfield"). The
 * forced "adjacent subfield" query injects off-topic literature for short prompts,
 * and equal weighting let those drift queries contribute as many papers as the core
 * concept — so clusters (and their titles) drifted away from the prompt.
 *
 * This planner instead derives a small set of WEIGHTED sub-queries grounded only in
 * terms that actually appear in the prompt, scaled to the prompt's specificity. An
 * LLM may *augment* it with bounded, low-weight vocabulary synonyms (see decompose.ts),
 * but it can never restructure or dominate the plan. Pure + dependency-free so it is a
 * single source of truth shared by the app and the validation harness.
 */

export type QueryField = 'taas' | 'search'
//  taas   → OpenAlex `title_and_abstract.search` filter (terms ANDed; high precision)
//  search → OpenAlex `search` param (relevance-ranked across title/abstract; recall)

export interface PlannedQuery {
  q: string
  field: QueryField
  weight: number // normalized so the plan sums to ~1
  role: 'anchor' | 'recall' | 'facet' | 'augment'
}

export type Specificity = 'broad' | 'medium' | 'specific'

// Compact academic stoplist — function words + filler that never narrows a search.
export const STOPWORDS = new Set<string>([
  'a', 'an', 'the', 'of', 'for', 'and', 'or', 'to', 'in', 'on', 'with', 'without',
  'via', 'using', 'use', 'used', 'based', 'toward', 'towards', 'into', 'from', 'by',
  'at', 'as', 'is', 'are', 'be', 'being', 'been', 'that', 'this', 'these', 'those',
  'it', 'its', 'their', 'our', 'we', 'study', 'studies', 'research', 'approach',
  'approaches', 'method', 'methods', 'analysis', 'review', 'novel', 'new', 'recent',
  'role', 'effect', 'effects', 'impact', 'about', 'between', 'across', 'over', 'how',
  'what', 'why', 'when', 'which', 'can', 'do', 'does', 'paper', 'papers', 'work',
])

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 2)
}

/** Light suffix stemmer — only for fuzzy coverage matching, never for query strings. */
export function stem(token: string): string {
  let t = token
  for (const suf of ['ization', 'isation', 'ically', 'ation', 'ings', 'ing', 'ies', 'ied', 'es', 'ed', 's']) {
    if (t.length > suf.length + 2 && t.endsWith(suf)) { t = t.slice(0, -suf.length); break }
  }
  return t
}

/** Content tokens: meaningful terms with stopwords removed (order preserved, deduped). */
export function contentTokens(prompt: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const tok of tokenize(prompt)) {
    if (STOPWORDS.has(tok)) continue
    if (seen.has(tok)) continue
    seen.add(tok)
    out.push(tok)
  }
  return out
}

export function classifySpecificity(prompt: string): Specificity {
  const n = contentTokens(prompt).length
  if (n <= 2) return 'broad'
  if (n <= 5) return 'medium'
  return 'specific'
}

/** Adjacent content-token n-grams actually present in the prompt (no invented terms). */
function nGrams(tokens: string[], n: number): string[] {
  const out: string[] = []
  for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i + n).join(' '))
  return out
}

function normalizeWeights(plan: PlannedQuery[]): PlannedQuery[] {
  const total = plan.reduce((s, p) => s + p.weight, 0) || 1
  return plan.map((p) => ({ ...p, weight: p.weight / total }))
}

/** De-duplicate sub-queries (same string+field), summing their weights. */
function dedupeQueries(plan: PlannedQuery[]): PlannedQuery[] {
  const map = new Map<string, PlannedQuery>()
  for (const p of plan) {
    const key = `${p.field}::${p.q.toLowerCase()}`
    const ex = map.get(key)
    if (ex) ex.weight += p.weight
    else map.set(key, { ...p })
  }
  return [...map.values()]
}

/**
 * Build a weighted query plan grounded only in the prompt's own terms.
 * Returns 1–5 sub-queries; the verbatim prompt is always the highest-weighted anchor.
 */
export function planQueries(seedTopic: string): PlannedQuery[] {
  const raw = seedTopic.trim()
  const ct = contentTokens(raw)
  const phrase = ct.join(' ')
  const spec = classifySpecificity(raw)

  // Degenerate / empty → just search the raw string.
  if (ct.length === 0) {
    return [{ q: raw || seedTopic, field: 'search', weight: 1, role: 'recall' }]
  }

  let plan: PlannedQuery[] = []

  if (spec === 'broad') {
    // 1–2 content words: stay tight on the concept; do NOT invent facets.
    plan = [
      { q: phrase, field: 'taas', weight: 0.62, role: 'anchor' },   // both terms in title/abstract
      { q: raw, field: 'search', weight: 0.38, role: 'recall' },    // relevance net for recall
    ]
  } else if (spec === 'medium') {
    // 3–5 content words: anchor + head concept + the salient bigrams present.
    const head = ct.slice(0, Math.min(3, ct.length)).join(' ')
    const bigrams = nGrams(ct, 2).slice(0, 2)
    plan = [
      { q: phrase, field: 'taas', weight: 0.42, role: 'anchor' },
      { q: head, field: 'taas', weight: 0.22, role: 'facet' },
      { q: raw, field: 'search', weight: 0.16, role: 'recall' },
      ...bigrams.map((b): PlannedQuery => ({ q: b, field: 'taas', weight: 0.10, role: 'facet' })),
    ]
  } else {
    // 6+ content words: precision-first. Anchor dominates; facets are real n-grams only.
    const trigrams = nGrams(ct, 3).slice(0, 2)
    const bigrams = nGrams(ct, 2)
    // Prefer the most "central" bigrams (skip the very first/last when enough exist).
    const pickedBigrams = (bigrams.length > 3 ? bigrams.slice(1, 4) : bigrams).slice(0, 3)
    plan = [
      { q: phrase, field: 'taas', weight: 0.50, role: 'anchor' },
      ...trigrams.map((t): PlannedQuery => ({ q: t, field: 'taas', weight: 0.14, role: 'facet' })),
      ...pickedBigrams.map((b): PlannedQuery => ({ q: b, field: 'taas', weight: 0.08, role: 'facet' })),
    ]
  }

  return normalizeWeights(dedupeQueries(plan)).slice(0, 6)
}

/**
 * Merge bounded LLM-suggested vocabulary synonyms into a deterministic plan.
 * Augment terms are capped in total influence so they can never dominate or
 * restructure the plan — they only widen vocabulary (e.g. "heart attack" →
 * "myocardial infarction"). `maxAugmentWeight` is the combined share they may take.
 */
export function mergeAugmentations(
  base: PlannedQuery[],
  augments: string[],
  maxAugmentWeight = 0.24,
  field: QueryField = 'taas',
  role: PlannedQuery['role'] = 'augment',
  maxCount = 3,
): PlannedQuery[] {
  const clean = augments
    .map((a) => a.trim())
    .filter((a) => a.length >= 3 && a.length <= 80)
    .slice(0, maxCount)
  if (clean.length === 0) return base

  const each = maxAugmentWeight / clean.length
  const scaledBase = base.map((p) => ({ ...p, weight: p.weight * (1 - maxAugmentWeight) }))
  const augPlan: PlannedQuery[] = clean.map((q) => ({ q, field, weight: each, role }))
  return normalizeWeights(dedupeQueries([...scaledBase, ...augPlan]))
}

/**
 * Coverage: fraction of the prompt's content tokens (stemmed) that appear in `text`.
 * Used both as a retrieval re-rank signal and as the validation fit metric.
 */
export function coverageScore(prompt: string, text: string): number {
  const promptStems = [...new Set(contentTokens(prompt).map(stem))]
  if (promptStems.length === 0) return 0
  const textStems = new Set(tokenize(text).map(stem))
  let hit = 0
  for (const s of promptStems) if (textStems.has(s)) hit++
  return hit / promptStems.length
}

/** Min-max normalize an array to [0,1]; flat arrays map to 0.5. */
export function minMaxNorm(values: number[]): number[] {
  if (values.length === 0) return []
  let lo = Infinity, hi = -Infinity
  for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v }
  if (hi - lo < 1e-9) return values.map(() => 0.5)
  return values.map((v) => (v - lo) / (hi - lo))
}

/**
 * Blend a candidate pool into final ranking scores. Relevance is primary; agreement
 * across sub-queries (weightBoost) and citation impact are secondary. Returns scores
 * aligned to the input order.
 */
export function blendRank(
  candidates: { relevance: number; citations: number; weightBoost: number }[],
): number[] {
  const rel = minMaxNorm(candidates.map((c) => c.relevance))
  const cit = minMaxNorm(candidates.map((c) => Math.log1p(Math.max(0, c.citations))))
  const boost = minMaxNorm(candidates.map((c) => c.weightBoost))
  return candidates.map((_, i) => 0.60 * rel[i] + 0.25 * boost[i] + 0.15 * cit[i])
}
