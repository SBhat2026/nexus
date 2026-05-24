export interface S2Author {
  authorId: string
  name: string
}

export interface S2Embedding {
  model: string
  vector: number[]
}

export interface S2Tldr {
  model: string
  text: string
}

export interface S2Paper {
  paperId: string
  title: string
  abstract?: string
  authors?: S2Author[]
  year?: number
  citationCount?: number
  referenceCount?: number
  embedding?: S2Embedding
  tldr?: S2Tldr
  externalIds?: { DOI?: string; ArXiv?: string }
}

export interface S2SearchResponse {
  total: number
  offset: number
  next?: number
  data: S2Paper[]
}

export interface S2BatchResponse {
  [index: number]: S2Paper
}

export interface S2RefsResponse {
  offset: number
  next?: number
  data: Array<{ citedPaper: S2Paper }>
}

export interface S2CitationsResponse {
  offset: number
  next?: number
  data: Array<{ citingPaper: S2Paper }>
}

export class S2Error extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'S2Error'
  }
}
