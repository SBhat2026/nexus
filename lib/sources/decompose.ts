import Groq from 'groq-sdk'
import { planQueries, mergeAugmentations, contentTokens, type PlannedQuery } from './queryPlanner'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

/**
 * Ask the LLM ONLY for vocabulary synonyms / canonical terminology for the core
 * concept — never for structure or "adjacent subfields". These are merged into the
 * deterministic plan with a hard-capped combined weight, so they can widen recall
 * (e.g. "heart attack" → "myocardial infarction") but can never make the corpus drift.
 */
async function suggestSynonyms(seedTopic: string): Promise<string[]> {
  if (!process.env.GROQ_API_KEY) return []
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 160,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an academic search librarian. Given a research topic, return canonical/synonymous TERMINOLOGY for the SAME concept that authors use in titles and abstracts — NOT adjacent or broader fields.
Rules:
- Each term 2-5 words, a genuine synonym or standard technical name for the SAME topic.
- Do NOT introduce new subtopics, applications, or related areas.
- If no strong synonym exists, return fewer (even zero).
- Return ONLY JSON: {"synonyms": ["...", "..."]} with at most 3 strings.`,
        },
        { role: 'user', content: `Research topic: "${seedTopic}"` },
      ],
    })
    const raw = completion.choices[0].message.content?.trim() ?? '{}'
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    const syn = Array.isArray(parsed?.synonyms) ? parsed.synonyms : []
    const promptTokens = new Set(contentTokens(seedTopic))
    // Drop suggestions that merely echo the prompt's own tokens verbatim.
    return syn
      .filter((s: unknown): s is string => typeof s === 'string')
      .map((s: string) => s.trim())
      .filter((s: string) => {
        const t = contentTokens(s)
        return t.length > 0 && t.some((tok) => !promptTokens.has(tok))
      })
      .slice(0, 3)
  } catch (err) {
    console.warn('[decompose] synonym augmentation failed, using deterministic plan only:', err)
    return []
  }
}

/**
 * Primary entry: a weighted, specificity-aware query plan. Deterministic backbone
 * (planQueries) + bounded LLM synonym augmentation. Always usable even with no API key.
 */
export async function planSearchQueries(
  seedTopic: string,
  opts: { augment?: boolean } = {},
): Promise<PlannedQuery[]> {
  const base = planQueries(seedTopic)
  if (opts.augment === false) return base
  const synonyms = await suggestSynonyms(seedTopic)
  return synonyms.length ? mergeAugmentations(base, synonyms) : base
}

/**
 * Back-compat: flat list of query strings (highest-weight first). Retained for any
 * caller that only needs strings; the retrieval layer should prefer planSearchQueries.
 */
export async function decomposeQuery(seedTopic: string): Promise<string[]> {
  const plan = await planSearchQueries(seedTopic)
  return [...plan].sort((a, b) => b.weight - a.weight).map((p) => p.q)
}
