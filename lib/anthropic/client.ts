import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_KEY ?? process.env.ANTHROPIC_API_KEY
  if (!key) return null
  if (!_client) _client = new Anthropic({ apiKey: key })
  return _client
}
