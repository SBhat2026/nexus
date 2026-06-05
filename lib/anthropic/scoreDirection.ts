import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'
import { z } from 'zod'
import { getClient } from './client'

// Independent novelty + feasibility scoring for a SINGLE research direction.
// Deliberately takes only that direction's own content plus the 3 papers closest to
// it (from a per-direction back-search) — never the parent cluster context — so every
// direction is judged on its own merits rather than inheriting one shared cluster score.

export interface DirectionToScore {
  title: string
  description: string
  // The direction's own suggested methodology drives the feasibility judgement.
  methodology: string[]
}

export interface ClosestPaper {
  title: string
  year: number | null
  citationCount: number
}

export interface DirectionScore {
  noveltyScore: number
  feasibilityScore: number
}

const ScoreSchema = z.object({
  noveltyScore: z.number().int().min(1).max(10),
  feasibilityScore: z.number().int().min(1).max(10),
})

function buildPrompt(d: DirectionToScore, closest: ClosestPaper[]): string {
  const closestText = closest.length
    ? closest.map((p, i) => `  ${i + 1}. "${p.title}" (${p.year ?? 'n/d'}, ${p.citationCount} citations)`).join('\n')
    : '  (no closely-matching prior work was found)'
  const methodText = d.methodology.length ? d.methodology.join('; ') : '(none specified)'
  return `Score ONE research direction on its own merits. Judge it only from the information below — do not assume anything about other directions.

Direction title: "${d.title}"
What it investigates: ${d.description}
Its suggested methodology / first steps: ${methodText}

The 3 closest existing papers (from a search using this direction's title):
${closestText}

Scoring (integers 1–10):
- noveltyScore: how distinct this direction is from the closest existing work above. 10 = no prior work addresses it; 1 = already thoroughly studied by those papers.
- feasibilityScore: how practically achievable this direction is GIVEN ITS OWN suggested methodology. 10 = standard tools/data, a team could start now; 1 = needs breakthroughs or inaccessible resources.

Respond with ONLY JSON: {"noveltyScore": <int>, "feasibilityScore": <int>}`
}

function parse(raw: string): DirectionScore | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = ScoreSchema.safeParse(JSON.parse(match[0]))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * Score a single direction independently. Uses Claude when a BYOK key is supplied,
 * otherwise Groq. Returns null when no model is configured / both fail (caller keeps
 * the generation-time estimate as a fallback).
 */
export async function scoreDirectionIndependently(
  direction: DirectionToScore,
  closest: ClosestPaper[],
  apiKey?: string | null,
): Promise<DirectionScore | null> {
  const prompt = buildPrompt(direction, closest)

  if (apiKey) {
    const client: Anthropic = new Anthropic({ apiKey })
    try {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 128,
        messages: [{ role: 'user', content: prompt }],
      })
      return parse(msg.content.find((b) => b.type === 'text')?.text ?? '')
    } catch {
      return null
    }
  }

  // Default path: shared server Anthropic client if available, else Groq.
  const anthropic = getClient()
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 128,
        messages: [{ role: 'user', content: prompt }],
      })
      const out = parse(msg.content.find((b) => b.type === 'text')?.text ?? '')
      if (out) return out
    } catch {
      /* fall through to Groq */
    }
  }

  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) return null
  try {
    const groq = new Groq({ apiKey: groqKey })
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You score a single research direction. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 128,
      response_format: { type: 'json_object' },
    })
    return parse(completion.choices[0].message.content ?? '')
  } catch {
    return null
  }
}
