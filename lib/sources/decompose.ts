// Sourcing baseline (before/after relevance-filter paper counts for the 4
// verification queries; fill in after a keyed run):
//   "breadcrumb navigation in UI design"      — before: __ / after: __
//   "CRISPR-Cas9 in human disease modeling"   — before: __ / after: __
//   "attention mechanisms in transformers"    — before: __ / after: __  (regression)
//   "behavioral economics and decision-making"— before: __ / after: __
import Groq from 'groq-sdk'
import { planQueries, mergeAugmentations, contentTokens, type PlannedQuery } from './queryPlanner'

// Lazy client (matches lib/groq/* + drilldown.ts): constructing Groq at module scope
// throws when GROQ_API_KEY is unset, which breaks `next build` page-data collection.
let _groq: Groq | null = null
function groqClient(): Groq | null {
  const key = process.env.GROQ_API_KEY
  if (!key) return null
  if (!_groq) _groq = new Groq({ apiKey: key })
  return _groq
}

export interface DomainIntel {
  domain: string | null
  ambiguities: string[]
  llmQueries: string[]
}

/**
 * Domain-anchored decomposition (chain-of-thought in one request): identify the
 * specific academic field, flag terms that mean different things across fields and
 * resolve them in that field's sense, then emit 4 domain-vocabulary sub-queries.
 * This fixes cross-domain ambiguity (e.g. "navigation" → wayfinding in HCI, not
 * robotics path-planning) without touching the deterministic planner backbone.
 */
export async function detectDomain(seedTopic: string, forcedDomain?: string): Promise<DomainIntel> {
  const groq = groqClient()
  if (!groq) return { domain: forcedDomain ?? null, ambiguities: [], llmQueries: [] }
  const forced = forcedDomain?.trim()
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert academic librarian with deep knowledge of how research fields use terminology differently. Given a research topic, you must:

STEP 1 — Identify the academic domain.
State the single most specific academic field this topic belongs to (e.g. "Human-Computer Interaction", "Molecular Biology", "Macroeconomics"). Be precise — do not default to broad terms like "Computer Science" when a more specific field applies.

STEP 2 — Identify ambiguous terms.
List any words in the topic that have different meanings across fields (e.g. "navigation" means path-planning in robotics but wayfinding in HCI; "network" means social graphs in sociology but neural nets in ML). State which meaning applies given the domain from Step 1.

STEP 3 — Generate 4 sub-queries.
Generate exactly 4 search queries a researcher in the Step 1 field would type into Google Scholar. Each query must:
- Be 3-7 words
- Use vocabulary specific to the Step 1 domain (NOT common-language or cross-domain interpretations)
- Collectively cover: (a) core concept, (b) primary application, (c) key methodology or framework, (d) adjacent subfield
- Never use the ambiguous terms identified in Step 2 unless qualified with domain-specific context

Return ONLY valid JSON in this exact shape, no preamble, no markdown:
{
  "domain": "<field name>",
  "ambiguities": ["<term>: <correct interpretation>"],
  "queries": ["<query1>", "<query2>", "<query3>", "<query4>"]
}`,
        },
        {
          role: 'user',
          content: forced
            ? `The topic is in the field of ${forced}. Given this context, analyze the research topic: "${seedTopic}"`
            : `Research topic: "${seedTopic}"`,
        },
      ],
    })
    const raw = completion.choices[0].message.content?.trim() ?? '{}'
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    const domain = typeof parsed?.domain === 'string' && parsed.domain.trim() ? parsed.domain.trim() : (forced ?? null)
    const ambiguities = Array.isArray(parsed?.ambiguities)
      ? parsed.ambiguities.filter((a: unknown): a is string => typeof a === 'string').slice(0, 6)
      : []
    const queries = Array.isArray(parsed?.queries)
      ? parsed.queries.filter((q: unknown): q is string => typeof q === 'string').map((q: string) => q.trim()).filter(Boolean).slice(0, 4)
      : []
    return { domain, ambiguities, llmQueries: queries }
  } catch (err) {
    console.warn('[decompose] domain detection failed, planner-only fallback:', err)
    return { domain: forced ?? null, ambiguities: [], llmQueries: [] }
  }
}

export interface RetrievalPlan {
  plan: PlannedQuery[]
  domain: string | null
  ambiguities: string[]
  llmQueries: string[]
}

/**
 * Primary retrieval orchestrator: deterministic specificity-aware planner backbone
 * (planQueries) + domain-anchored augmentation. The LLM's domain sub-queries are
 * merged as bounded, capped-weight `search` facets — they widen recall toward the
 * correct field but can never dominate or restructure the plan (anti-drift). If the
 * LLM is unavailable, the plan is exactly the grounded planner output.
 */
export async function buildRetrievalPlan(
  seedTopic: string,
  opts: { augment?: boolean; forcedDomain?: string } = {},
): Promise<RetrievalPlan> {
  const base = planQueries(seedTopic)
  if (opts.augment === false) return { plan: base, domain: opts.forcedDomain ?? null, ambiguities: [], llmQueries: [] }

  const intel = await detectDomain(seedTopic, opts.forcedDomain)

  // Drop sub-queries that merely echo the prompt's own tokens verbatim (they add no
  // new vocabulary); keep those that introduce domain-specific terms.
  const promptTokens = new Set(contentTokens(seedTopic))
  const usefulQueries = intel.llmQueries.filter((q) => {
    const t = contentTokens(q)
    return t.length > 0 && t.some((tok) => !promptTokens.has(tok))
  })

  const plan = usefulQueries.length
    ? mergeAugmentations(base, usefulQueries, 0.3, 'search', 'facet', 4)
    : base

  return { plan, domain: intel.domain, ambiguities: intel.ambiguities, llmQueries: intel.llmQueries }
}

/**
 * Ask the LLM ONLY for vocabulary synonyms / canonical terminology for the core
 * concept — never for structure or "adjacent subfields". These are merged into the
 * deterministic plan with a hard-capped combined weight, so they can widen recall
 * (e.g. "heart attack" → "myocardial infarction") but can never make the corpus drift.
 */
async function suggestSynonyms(seedTopic: string): Promise<string[]> {
  const groq = groqClient()
  if (!groq) return []
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
