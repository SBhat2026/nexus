export interface OAAuthor {
  author: { id: string; display_name: string }
  institutions?: { display_name: string }[]
}

export interface OAWork {
  id: string                                        // full URL e.g. https://openalex.org/W123
  title: string
  abstract_inverted_index: Record<string, number[]> | null
  authorships: OAAuthor[]
  publication_year: number | null
  cited_by_count: number
  referenced_works: string[]                        // OpenAlex full URLs
}

export interface OASearchResponse {
  results: OAWork[]
  meta: { count: number; page: number; per_page: number }
}

export class OAError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'OAError'
  }
}

/** Strip full OpenAlex URL to bare ID: "https://openalex.org/W123" → "W123" */
export function oaId(fullUrl: string): string {
  return fullUrl.replace('https://openalex.org/', '')
}

/** Reconstruct abstract from OpenAlex inverted index format. */
export function reconstructAbstract(inv: Record<string, number[]> | null): string {
  if (!inv) return ''
  const words: string[] = []
  for (const [word, positions] of Object.entries(inv)) {
    for (const pos of positions) words[pos] = word
  }
  return words.filter(Boolean).join(' ')
}
