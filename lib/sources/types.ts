export interface SourceWork {
  id: string              // bare: 'W12345' or 'core:12345'
  title: string
  abstract: string | null
  authors: string[]
  year: number | null
  citationCount: number
  venue: string | null
  referencedWorkIds: string[]
  sourceProvider: 'openalex' | 'core'
}
