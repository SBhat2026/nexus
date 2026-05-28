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

/**
 * Embed an array of strings using jina-embeddings-v3 (1024-dim).
 * Returns embeddings in the same order as the input.
 * Batches of 200, runs in parallel, retries once on 429/5xx.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const key = process.env.JINA_API_KEY
  if (!key) throw new JinaError(401, 'JINA_API_KEY not set')

  const BATCH = 200
  const batches: string[][] = []
  for (let i = 0; i < texts.length; i += BATCH) batches.push(texts.slice(i, i + BATCH))

  const responses = await Promise.all(batches.map(async (batch, batchIdx) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch('https://api.jina.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'jina-embeddings-v3',
          input: batch,
          task: 'text-matching',
        }),
      })
      if (res.ok) return { batchIdx, data: (await res.json() as JinaResponse).data }
      if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
        await new Promise((r) => setTimeout(r, 500))
        continue
      }
      throw new JinaError(res.status, `Jina error ${res.status}: ${await res.text()}`)
    }
    throw new JinaError(0, 'Jina retry exhausted')
  }))

  const results: number[][] = new Array(texts.length)
  for (const { batchIdx, data } of responses) {
    const offset = batchIdx * BATCH
    data.forEach((d) => { results[offset + d.index] = d.embedding })
  }
  return results
}

/** Convenience: embed title + abstract as a single input string. */
export function paperToText(title: string, abstract: string): string {
  return abstract ? `${title}. ${abstract}` : title
}
