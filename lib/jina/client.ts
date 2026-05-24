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
 * Batches automatically if > 100 items.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const key = process.env.JINA_API_KEY
  if (!key) throw new JinaError(401, 'JINA_API_KEY not set')

  const BATCH = 100
  const results: number[][] = new Array(texts.length)

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH)
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

    if (!res.ok) {
      const body = await res.text()
      throw new JinaError(res.status, `Jina error ${res.status}: ${body}`)
    }

    const data: JinaResponse = await res.json()
    data.data.forEach((d) => { results[i + d.index] = d.embedding })
  }

  return results
}

/** Convenience: embed title + abstract as a single input string. */
export function paperToText(title: string, abstract: string): string {
  return abstract ? `${title}. ${abstract}` : title
}
