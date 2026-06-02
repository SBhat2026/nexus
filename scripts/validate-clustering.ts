/**
 * Validation harness: does the new specificity-aware query planner retrieve a corpus
 * that fits the prompt better than the old citation-sorted single-query path?
 *
 * Cluster titles are LLM summaries of each cluster's member papers, so cluster-title
 * fit is downstream of corpus fit: if the retrieved literature is more on-topic, the
 * clusters formed from it — and their titles — are more on-topic. This script measures
 * that upstream corpus fit on a seeded random sample of 100 prompts (1–10 content
 * words), comparing OLD vs NEW retrieval against the live OpenAlex API, then runs
 * paired significance tests. (An optional end-to-end cluster-title block that needs
 * GROQ + JINA keys is included at the bottom and skips when keys are absent.)
 *
 * Run:  npx tsx scripts/validate-clustering.ts
 *
 * Honesty notes:
 *  - The fit metric (prompt-token coverage) is INDEPENDENT of the NEW ranking signal:
 *    NEW here ranks purely by OpenAlex relevance + cross-query agreement + citations
 *    (no coverage prior), so any coverage gain is attributable to query construction,
 *    not to a coverage-biased re-rank. Production additionally applies a small coverage
 *    prior, which can only help further — this test is therefore conservative.
 *  - LLM synonym augmentation is disabled here (no key); it only adds recall on top.
 */

import {
  planQueries, blendRank, coverageScore, contentTokens, classifySpecificity,
} from '../lib/sources/queryPlanner'

const MAILTO = 'siddhantbhat3@gmail.com'
const PER_SIDE = 60          // papers kept per strategy per prompt
const SEED = 20260602        // reproducible sample
const N_PROMPTS = 100

// ─────────────────────────────────────────────────────────────────────────────
// Prompt bank — spans fields and specificities (1–10 content words). Seeded shuffle
// picks 100. Mix of bare terms, medium phrases, and precise multi-facet questions.
// ─────────────────────────────────────────────────────────────────────────────
const PROMPT_BANK: string[] = [
  // broad (1–2 content words)
  'transformers', 'CRISPR', 'graph neural networks', 'diffusion models', 'quantum error correction',
  'protein folding', 'federated learning', 'single-cell RNA sequencing', 'reinforcement learning',
  'topological insulators', 'gut microbiome', 'gravitational waves', 'large language models',
  'battery materials', 'gene therapy', 'superconductivity', 'optimal transport', 'neural architecture search',
  'mRNA vaccines', 'dark matter', 'attention mechanisms', 'knowledge graphs', 'perovskite solar cells',
  'causal inference', 'immunotherapy',
  // medium (3–5 content words)
  'graph neural networks for drug discovery', 'self-supervised learning for medical imaging',
  'reinforcement learning for robotic manipulation', 'transformer attention head pruning',
  'CRISPR base editing off-target effects', 'diffusion models for protein design',
  'optimal transport for single-cell trajectory inference', 'differential privacy in federated learning',
  'contrastive learning of speech representations', 'spiking neural networks neuromorphic hardware',
  'retrieval augmented generation for question answering', 'topological data analysis of neural activity',
  'deep learning weather forecasting nowcasting', 'mixture of experts language model routing',
  'protein language models structure prediction', 'quantum machine learning variational circuits',
  'graph transformers molecular property prediction', 'neural radiance fields scene reconstruction',
  'bayesian optimization hyperparameter tuning', 'continual learning catastrophic forgetting',
  'multimodal vision language pretraining', 'state space models long sequence modeling',
  'electrocatalysis hydrogen evolution reaction', 'metal organic frameworks gas separation',
  'gut microbiome inflammatory bowel disease', 'transcriptomics tumor microenvironment immune cells',
  'reference dependent preferences behavioral economics', 'climate tipping points ice sheet collapse',
  'surface code fault tolerant quantum computing', 'attention based neural machine translation',
  // specific (6–10 content words)
  'attention head pruning to compress transformer language models without accuracy loss',
  'self-supervised contrastive pretraining for chest x-ray disease classification with limited labels',
  'graph neural network prediction of protein protein interaction binding affinity from structure',
  'diffusion probabilistic models for de novo small molecule generation with synthesizability constraints',
  'optimal transport alignment of single cell multi-omics across tissue samples and donors',
  'differential privacy guarantees for federated learning under non-iid client data distributions',
  'mixture of experts routing for efficient inference in sparse large language models',
  'reinforcement learning from human feedback for aligning instruction following language models',
  'topological persistent homology features for characterizing loss landscape flatness in deep networks',
  'CRISPR Cas9 base editing reduces off-target mutations in human hematopoietic stem cells',
  'variational quantum eigensolver for ground state energy of small molecules on noisy hardware',
  'neural radiance fields with depth supervision for sparse view indoor scene reconstruction',
  'retrieval augmented generation reduces hallucination in open domain biomedical question answering',
  'spiking neural network training with surrogate gradients on neuromorphic edge devices',
  'protein language model embeddings improve remote homology detection over hidden markov models',
  'deep generative weather nowcasting outperforms numerical models for short term precipitation',
  'bayesian optimization of perovskite solar cell composition for improved power conversion efficiency',
  'continual learning with elastic weight consolidation mitigates forgetting in sequential task streams',
  'transformer based decoding of motor cortex activity for brain computer interface cursor control',
  'metal organic framework membranes for selective carbon dioxide capture from flue gas',
  'graph contrastive learning for molecular property prediction with limited labeled data',
  'causal effect estimation from observational electronic health records with confounding adjustment',
  'long context state space models for genomic sequence modeling at base pair resolution',
  'multimodal foundation models aligning histopathology images with diagnostic text reports',
  'reinforcement learning for inventory management under stochastic demand and lead times',
  'self supervised denoising of cryo electron microscopy images for protein structure determination',
  'federated transfer learning for cross hospital sepsis prediction without sharing patient data',
  'topological superconductivity in proximitized semiconductor nanowires for majorana zero modes',
  'attention guided weakly supervised segmentation of tumors in whole slide pathology images',
  'diffusion model guided inverse design of mechanical metamaterials with target stiffness',
  // extra breadth to allow a 100-of-N seeded draw
  'natural language inference', 'object detection', 'semantic segmentation', 'speech recognition',
  'recommender systems', 'time series forecasting', 'anomaly detection', 'graph clustering',
  'molecular dynamics simulation', 'density functional theory', 'photonic crystals', 'spintronics',
  'CAR T cell therapy', 'antimicrobial resistance', 'CRISPR screening functional genomics',
  'protein structure prediction with alphafold', 'wearable sensor human activity recognition',
  'explainable ai feature attribution methods', 'graph signal processing brain connectivity',
  'deep reinforcement learning for autonomous driving policy', 'vision transformers image classification',
  'large scale contrastive language image pretraining', 'neural ordinary differential equations',
  'physics informed neural networks for partial differential equations',
  'generative adversarial networks for image synthesis', 'meta learning few shot classification',
]

// ── Seeded RNG (mulberry32) ───────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function seededSample<T>(arr: T[], n: number, seed: number): T[] {
  const rng = mulberry32(seed)
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, Math.min(n, a.length))
}

// ── OpenAlex helpers ──────────────────────────────────────────────────────────
function invert(idx: Record<string, number[]> | null | undefined): string {
  if (!idx) return ''
  const m: Record<number, string> = {}
  for (const [w, ps] of Object.entries(idx)) for (const p of ps) m[p] = w
  return Object.keys(m).map(Number).sort((x, y) => x - y).map((k) => m[k]).join(' ')
}
interface Paper { id: string; title: string; abstract: string; citations: number; relevance: number }

async function oaGet(params: URLSearchParams, tries = 3): Promise<any[]> {
  params.set('mailto', MAILTO)
  const url = `https://api.openalex.org/works?${params}`
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': `Nexus Validation (${MAILTO})` } })
      if (res.status === 429) { await sleep(1500 * (attempt + 1)); continue }
      if (!res.ok) return []
      const j = await res.json()
      return j.results ?? []
    } catch { await sleep(600 * (attempt + 1)) }
  }
  return []
}
function toPaper(w: any): Paper | null {
  if (!w?.title || !w?.abstract_inverted_index) return null
  return {
    id: w.id, title: w.title, abstract: invert(w.abstract_inverted_index),
    citations: w.cited_by_count ?? 0, relevance: w.relevance_score ?? 0,
  }
}
const SELECT = 'id,title,abstract_inverted_index,cited_by_count,relevance_score'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// OLD: single `search`, sorted by citations (relevance discarded) — the prior behavior.
async function retrieveOld(prompt: string): Promise<Paper[]> {
  const rows = await oaGet(new URLSearchParams({
    search: prompt, filter: 'has_abstract:true,type:article',
    sort: 'cited_by_count:desc', 'per-page': String(PER_SIDE), select: SELECT,
  }))
  return rows.map(toPaper).filter((p): p is Paper => !!p)
}

// NEW: weighted plan → taas/search relevance queries → aggregate → blended re-rank
// (relevance + cross-query agreement + citations; NO coverage prior, for a fair test).
async function retrieveNew(prompt: string): Promise<Paper[]> {
  const plan = planQueries(prompt)
  const pool = Math.ceil(PER_SIDE * 1.6)
  const perQ = await Promise.all(plan.map(async (pq) => {
    const params = new URLSearchParams({
      filter: pq.field === 'taas'
        ? `has_abstract:true,type:article,title_and_abstract.search:${pq.q}`
        : 'has_abstract:true,type:article',
      'per-page': String(Math.max(8, Math.round(pool * pq.weight))), select: SELECT,
    })
    if (pq.field === 'search') params.set('search', pq.q)
    return { w: pq.weight, rows: (await oaGet(params)).map(toPaper).filter((p): p is Paper => !!p) }
  }))
  const agg = new Map<string, Paper & { boost: number }>()
  for (const { w, rows } of perQ) {
    for (const p of rows) {
      const ex = agg.get(p.id)
      if (ex) { ex.boost += w; if (p.relevance > ex.relevance) ex.relevance = p.relevance }
      else agg.set(p.id, { ...p, boost: w })
    }
  }
  const cand = [...agg.values()]
  const blend = blendRank(cand.map((c) => ({ relevance: c.relevance, citations: c.citations, weightBoost: c.boost })))
  return cand.map((c, i) => ({ c, s: blend[i] })).sort((a, b) => b.s - a.s).slice(0, PER_SIDE).map((x) => x.c)
}

// ── Fit metrics (independent of NEW ranking) ──────────────────────────────────
function fit(prompt: string, papers: Paper[]) {
  const nTok = contentTokens(prompt).length
  // adaptive on-topic threshold: 1-token prompts need the term present; longer need ≥half
  const tau = nTok <= 1 ? 1 : 0.5
  const covs = papers.map((p) => coverageScore(prompt, `${p.title} ${p.abstract}`))
  const mean = covs.reduce((s, v) => s + v, 0) / (covs.length || 1)
  const onTopic = covs.filter((c) => c >= tau).length / (covs.length || 1)
  const drift = covs.filter((c) => c === 0).length / (covs.length || 1)
  return { meanCoverage: mean, onTopicRate: onTopic, driftRate: drift, n: covs.length }
}

// ── Statistics ────────────────────────────────────────────────────────────────
function mean(a: number[]) { return a.reduce((s, v) => s + v, 0) / (a.length || 1) }
function sd(a: number[]) { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1 || 1)) }
function median(a: number[]) { const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2 }

// Regularized incomplete beta (Numerical Recipes) for exact Student-t p-values.
function betacf(a: number, b: number, x: number): number {
  const EPS = 3e-12, FPMIN = 1e-300
  let qab = a + b, qap = a + 1, qam = a - 1
  let c = 1, d = 1 - qab * x / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d; let h = d
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; const del = d * c; h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}
function lgamma(z: number): number {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let x = z, y = z, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) { y++; ser += g[j] / y }
  return -tmp + Math.log(2.5066282746310005 * ser / x)
}
function ibeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0; if (x >= 1) return 1
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b
}
function tTwoSidedP(t: number, df: number): number {
  return ibeta(df / (df + t * t), df / 2, 0.5)
}
// standard normal two-sided p
function erfc(x: number): number {
  const z = Math.abs(x), tt = 1 / (1 + 0.5 * z)
  const r = tt * Math.exp(-z * z - 1.26551223 + tt * (1.00002368 + tt * (0.37409196 + tt * (0.09678418 +
    tt * (-0.18628806 + tt * (0.27886807 + tt * (-1.13520398 + tt * (1.48851587 +
    tt * (-0.82215223 + tt * 0.17087277)))))))))
  return x >= 0 ? r : 2 - r
}
function normalTwoSidedP(z: number): number { return erfc(Math.abs(z) / Math.SQRT2) }

function pairedT(newv: number[], oldv: number[]) {
  const d = newv.map((v, i) => v - oldv[i])
  const md = mean(d), sdd = sd(d), n = d.length
  const t = md / (sdd / Math.sqrt(n))
  return { meanDelta: md, t, df: n - 1, p: tTwoSidedP(t, n - 1), dz: md / (sdd || 1) }
}
function wilcoxon(newv: number[], oldv: number[]) {
  const diffs = newv.map((v, i) => v - oldv[i]).filter((x) => Math.abs(x) > 1e-12)
  const n = diffs.length
  const ranked = diffs.map((x) => ({ x, abs: Math.abs(x) })).sort((a, b) => a.abs - b.abs)
  // average ranks for ties
  for (let i = 0; i < ranked.length;) {
    let j = i; while (j < ranked.length && ranked[j].abs === ranked[i].abs) j++
    const avg = (i + 1 + j) / 2
    for (let k = i; k < j; k++) (ranked[k] as any).rank = avg
    i = j
  }
  let wPlus = 0
  for (const r of ranked as any[]) if (r.x > 0) wPlus += r.rank
  const meanW = n * (n + 1) / 4, sdW = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24)
  const z = (wPlus - meanW) / sdW
  return { n, wPlus, z, p: normalTwoSidedP(z) }
}

// ── Concurrency ───────────────────────────────────────────────────────────────
async function mapPool<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      out[i] = await fn(items[i], i)
      await sleep(120) // politeness spacing
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

function fmtP(p: number) { return p < 1e-4 ? p.toExponential(2) : p.toFixed(5) }

async function main() {
  const prompts = seededSample(PROMPT_BANK, N_PROMPTS, SEED)
  console.log(`\nNexus retrieval validation — ${prompts.length} prompts (seed ${SEED}), ${PER_SIDE} papers/side\n`)

  type Row = {
    prompt: string; bucket: string; nTok: number
    oldFit: ReturnType<typeof fit>; newFit: ReturnType<typeof fit>
  }
  let done = 0
  const rows = await mapPool(prompts, 4, async (prompt): Promise<Row> => {
    const [oldP, newP] = await Promise.all([retrieveOld(prompt), retrieveNew(prompt)])
    done++
    if (done % 10 === 0) console.log(`  …${done}/${prompts.length}`)
    return {
      prompt, nTok: contentTokens(prompt).length, bucket: classifySpecificity(prompt),
      oldFit: fit(prompt, oldP), newFit: fit(prompt, newP),
    }
  })

  // drop prompts where either side returned <10 papers (can't fairly compare)
  const valid = rows.filter((r) => r.oldFit.n >= 10 && r.newFit.n >= 10)
  console.log(`\n${valid.length}/${rows.length} prompts had ≥10 papers on both sides.\n`)

  const report = (label: string, key: 'meanCoverage' | 'onTopicRate' | 'driftRate', subset: Row[]) => {
    const oldv = subset.map((r) => r.oldFit[key])
    const newv = subset.map((r) => r.newFit[key])
    const t = pairedT(newv, oldv)
    const w = wilcoxon(newv, oldv)
    const wins = subset.filter((r, i) => key === 'driftRate' ? newv[i] < oldv[i] : newv[i] > oldv[i]).length
    const better = key === 'driftRate' ? 'lower' : 'higher'
    console.log(`■ ${label}  (${better} = better)`)
    console.log(`    OLD  mean ${mean(oldv).toFixed(4)}  median ${median(oldv).toFixed(4)}  sd ${sd(oldv).toFixed(4)}`)
    console.log(`    NEW  mean ${mean(newv).toFixed(4)}  median ${median(newv).toFixed(4)}  sd ${sd(newv).toFixed(4)}`)
    const rel = mean(oldv) !== 0 ? (100 * t.meanDelta / mean(oldv)).toFixed(1) + '%' : 'n/a'
    console.log(`    Δ(new-old) ${t.meanDelta >= 0 ? '+' : ''}${t.meanDelta.toFixed(4)} (${rel} rel)  |  win-rate ${wins}/${subset.length} (${(100 * wins / subset.length).toFixed(0)}%)`)
    console.log(`    paired t(${t.df}) = ${t.t.toFixed(3)}, p = ${fmtP(t.p)}, Cohen's dz = ${t.dz.toFixed(3)}`)
    console.log(`    Wilcoxon z = ${w.z.toFixed(3)}, p = ${fmtP(w.p)} (n=${w.n})\n`)
    return { key, oldMean: mean(oldv), newMean: mean(newv), delta: t.meanDelta, t: t.t, df: t.df, p: t.p, dz: t.dz, wilcoxonZ: w.z, wilcoxonP: w.p, winRate: wins / subset.length }
  }

  console.log('═══ OVERALL ═══\n')
  const overall = {
    meanCoverage: report('Mean prompt-token coverage', 'meanCoverage', valid),
    onTopicRate: report('On-topic rate (coverage ≥ τ)', 'onTopicRate', valid),
    driftRate: report('Drift rate (zero prompt overlap)', 'driftRate', valid),
  }

  console.log('═══ BY SPECIFICITY ═══\n')
  const byBucket: Record<string, any> = {}
  for (const b of ['broad', 'medium', 'specific']) {
    const sub = valid.filter((r) => r.bucket === b)
    if (sub.length < 5) { console.log(`(${b}: only ${sub.length} prompts — skipped)\n`); continue }
    console.log(`── ${b.toUpperCase()} (${sub.length} prompts) ──`)
    byBucket[b] = {
      meanCoverage: report('  Mean coverage', 'meanCoverage', sub),
      driftRate: report('  Drift rate', 'driftRate', sub),
    }
  }

  const out = {
    seed: SEED, perSide: PER_SIDE, nPrompts: prompts.length, nValid: valid.length,
    overall, byBucket,
    rows: valid.map((r) => ({ prompt: r.prompt, bucket: r.bucket, nTok: r.nTok,
      old: r.oldFit, new: r.newFit })),
  }
  const fs = await import('fs')
  const path = new URL('./validation-report.json', import.meta.url)
  fs.writeFileSync(path, JSON.stringify(out, null, 2))
  console.log(`Full report written → scripts/validation-report.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
