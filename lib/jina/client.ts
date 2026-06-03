export class JinaError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'JinaError'
  }
}

interface JinaResponse {
  data: { index: number; embedding: number[] }[]
  model: string
  usage: { total_tokens: number }
}

// Jina's free/standard key is ~100k tokens/min. The previous pacing was purely
// time-based (40-paper batches, 2s gaps) which ignores token volume: a single
// fresh query of ~150 full abstracts is ~140k tokens and blew the budget in one
// burst, 429-ing the seed embed that the relevance filter depends on. We now:
//   1. truncate abstracts so per-paper token cost is bounded, and
//   2. pace by an actual token-budget ROLLING WINDOW (process-global), so both a
//      single large corpus and back-to-back queries stay under the per-minute cap.
// The 429 backoff remains as a last-resort safety net.
const TOKEN_LIMIT_PER_MIN = 90_000 // headroom below Jina's 100k/min
const WINDOW_MS = 60_000
const MAX_BATCH_ITEMS = 40
const MAX_BATCH_TOKENS = 30_000 // keep any single request well inside the window
const RATE_LIMIT_WAIT_MS = 65_000 // wait out Jina's 1-minute token window
const MAX_ABSTRACT_CHARS = 1_600 // ~400 tokens; plenty for relevance/clustering

// Rough token estimate — Jina tokenizes English at ~4 chars/token.
function estTokens(text: string): number {
  return Math.ceil(text.length / 4) + 2
}

// Process-global rolling window of recent token spend. Shared across every caller
// (create / drilldown / expand) so the limiter respects the per-KEY budget, not a
// per-request one.
const recent: { t: number; tokens: number }[] = []

// Block until sending `tokens` more keeps the trailing-60s spend under the cap.
async function reserveTokens(tokens: number): Promise<void> {
  for (;;) {
    const now = Date.now()
    while (recent.length && now - recent[0].t > WINDOW_MS) recent.shift()
    const used = recent.reduce((s, r) => s + r.tokens, 0)
    // Always allow progress if the window is empty (a lone batch bigger than the
    // cap can't be split further than MAX_BATCH_TOKENS anyway).
    if (recent.length === 0 || used + tokens <= TOKEN_LIMIT_PER_MIN) {
      recent.push({ t: now, tokens })
      return
    }
    const waitMs = WINDOW_MS - (now - recent[0].t) + 50
    await new Promise((r) => setTimeout(r, waitMs))
  }
}

// Split into batches bounded by BOTH item count and token volume.
function makeBatches(texts: string[]): string[][] {
  const batches: string[][] = []
  let cur: string[] = []
  let curTokens = 0
  for (const t of texts) {
    const tk = estTokens(t)
    if (cur.length && (cur.length >= MAX_BATCH_ITEMS || curTokens + tk > MAX_BATCH_TOKENS)) {
      batches.push(cur)
      cur = []
      curTokens = 0
    }
    cur.push(t)
    curTokens += tk
  }
  if (cur.length) batches.push(cur)
  return batches
}

async function embedBatchWithRetry(batch: string[], key: string, maxRetries = 3): Promise<number[][]> {
  const batchTokens = batch.reduce((s, t) => s + estTokens(t), 0)
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await reserveTokens(batchTokens)
    const res = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'jina-embeddings-v3', input: batch, task: 'text-matching' }),
    })
    if (res.ok) {
      const json = (await res.json()) as JinaResponse
      const out = new Array<number[]>(batch.length)
      json.data.forEach((d) => { out[d.index] = d.embedding })
      return out
    }
    if (res.status === 429 && attempt < maxRetries) {
      // Token rate limit slipped through despite pacing: wait out the full window,
      // then retry the same batch.
      await new Promise((r) => setTimeout(r, RATE_LIMIT_WAIT_MS))
      continue
    }
    if (res.status >= 500 && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1_000))
      continue
    }
    throw new JinaError(res.status, `Jina error ${res.status}: ${await res.text()}`)
  }
  throw new JinaError(0, 'Jina retry exhausted')
}

/**
 * Embed an array of strings using jina-embeddings-v3 (1024-dim), returning
 * embeddings in input order. Batches are bounded by item count AND token volume,
 * and paced by a process-global rolling token-budget window so a large fresh
 * corpus (or several back-to-back queries) cannot exceed Jina's per-minute cap.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const key = process.env.JINA_API_KEY
  if (!key) throw new JinaError(401, 'JINA_API_KEY not set')

  const results: number[][] = []
  for (const batch of makeBatches(texts)) {
    const vecs = await embedBatchWithRetry(batch, key)
    results.push(...vecs)
  }
  return results
}

/**
 * Convenience: embed title + abstract as a single input string. The abstract is
 * truncated to cap per-paper token cost (full abstracts averaged ~925 tokens and
 * routinely blew the rate limit); the leading sentences carry the topical signal.
 */
export function paperToText(title: string, abstract: string): string {
  if (!abstract) return title
  const a = abstract.length > MAX_ABSTRACT_CHARS ? abstract.slice(0, MAX_ABSTRACT_CHARS) : abstract
  return `${title}. ${a}`
}
