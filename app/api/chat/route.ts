import { NextRequest } from 'next/server'
import Groq from 'groq-sdk'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

export const maxDuration = 30

const GraphActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add_node'), nodeType: z.literal('cluster'), label: z.string(), description: z.string().optional(), confidence: z.number().min(0).max(1), reason: z.string() }),
  z.object({ type: z.literal('remove_node'), targetId: z.string(), confidence: z.number().min(0).max(1), reason: z.string() }),
  z.object({ type: z.literal('add_edge'), sourceId: z.string(), targetId: z.string(), edgeType: z.enum(['citation', 'semantic_similarity', 'generated_from']).optional(), confidence: z.number().min(0).max(1), reason: z.string() }),
  z.object({ type: z.literal('remove_edge'), edgeId: z.string(), confidence: z.number().min(0).max(1), reason: z.string() }),
])

const ResponseSchema = z.object({
  text: z.string(),
  action: z.union([
    z.object({
      type: z.literal('suggest_reframe'),
      newTopic: z.string(),
      reason: z.string(),
    }),
    z.null(),
  ]).default(null),
  // Up to 3 reviewable graph edits; capped server-side regardless of what the model returns.
  graphActions: z.array(GraphActionSchema).max(8).optional().default([]),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const message: string = (body.message ?? '').trim()
    const sessionId: string = body.sessionId ?? ''
    const context = body.context ?? {}
    const history: { role: 'user' | 'assistant'; content: string }[] = body.history ?? []

    if (!message) return Response.json({ error: 'message required' }, { status: 400 })

    const {
      seedTopic = '',
      clusters = [],
      selectedNode = null,
      prunedClusters = [],
      directions = [],
    } = context

    const clusterArr = clusters as { id: string; label: string; description: string; paperCount: number }[]
    const clusterList = clusterArr
      .map(c => `• ${c.label} (${c.paperCount} papers)${c.description ? ': ' + c.description : ''}`)
      .join('\n') || 'No clusters loaded'

    // id → label reference so the model can target existing nodes in graph edits.
    const clusterRefList = clusterArr.length
      ? clusterArr.map(c => `${c.id} = ${c.label}`).join('\n')
      : 'No clusters loaded'

    const prunedList = (prunedClusters as { label: string; reason: string }[]).length > 0
      ? prunedClusters.map((p: { label: string; reason: string }) => `• ${p.label} — "${p.reason}"`).join('\n')
      : 'None'

    const directionList = (directions as { title: string; description: string }[]).length > 0
      ? directions.map((d: { title: string; description: string }) => `• ${d.title}: ${d.description}`).join('\n')
      : 'None yet'

    type SelectedNode = {
      nodeType: string
      label?: string
      title?: string
      year?: number
      authors?: string[]
      tldr?: string
      abstract?: string
      citationCount?: number
      clusterId?: string
      description?: string
      paperCount?: number
      medianYear?: number
      clusterQuality?: number
      rationale?: string
      noveltyScore?: number
      feasibilityScore?: number
      suggestedNextSteps?: string[]
      mahalanobisDistance?: number
      outlierExplanation?: string
      bridgePotential?: string
      // session-level fallback fields
      clusterCount?: number
      clusterLabels?: string[]
    }
    const sn = selectedNode as SelectedNode | null

    let selInfo = ''
    if (sn) {
      const lines: string[] = [`Currently selected: ${sn.nodeType}`]
      if (sn.nodeType === 'paper' || sn.nodeType === 'outlier') {
        if (sn.title) lines.push(`Title: ${sn.title}`)
        if (sn.year) lines.push(`Year: ${sn.year}`)
        if (sn.authors?.length) lines.push(`Authors: ${sn.authors.slice(0, 3).join(', ')}`)
        if (sn.citationCount != null) lines.push(`Citations: ${sn.citationCount}`)
        if (sn.tldr) lines.push(`TL;DR: ${sn.tldr}`)
        else if (sn.abstract) lines.push(`Abstract (excerpt): ${sn.abstract.slice(0, 600)}`)
        if (sn.nodeType === 'outlier') {
          if (sn.outlierExplanation) lines.push(`Outlier reason: ${sn.outlierExplanation}`)
          if (sn.bridgePotential) lines.push(`Bridge potential: ${sn.bridgePotential}`)
        }
      } else if (sn.nodeType === 'cluster') {
        if (sn.label) lines.push(`Cluster: ${sn.label}`)
        if (sn.description) lines.push(`Description: ${sn.description}`)
        if (sn.paperCount != null) lines.push(`Papers: ${sn.paperCount}`)
        if (sn.medianYear) lines.push(`Median paper year: ${sn.medianYear}`)
        if (sn.clusterQuality != null) lines.push(`Quality: ${(sn.clusterQuality * 100).toFixed(0)}%`)
      } else if (sn.nodeType === 'direction') {
        if (sn.title) lines.push(`Direction: ${sn.title}`)
        if (sn.description) lines.push(`Description: ${sn.description}`)
        if (sn.rationale) lines.push(`Rationale: ${sn.rationale}`)
        if (sn.noveltyScore != null) lines.push(`Novelty: ${sn.noveltyScore}/10`)
        if (sn.feasibilityScore != null) lines.push(`Feasibility: ${sn.feasibilityScore}/10`)
        if (sn.suggestedNextSteps?.length) lines.push(`Next steps: ${sn.suggestedNextSteps.join('; ')}`)
      } else if (sn.nodeType === 'session') {
        lines.push(`Session overview for: ${sn.label ?? seedTopic}`)
        if (sn.clusterCount != null) lines.push(`Total clusters: ${sn.clusterCount}`)
        if (sn.paperCount != null) lines.push(`Total papers analyzed: ${sn.paperCount}`)
        if (sn.clusterLabels?.length) lines.push(`Cluster topics: ${sn.clusterLabels.join(', ')}`)
      }
      selInfo = lines.join('\n')
    }

    const systemPrompt = `You are a research navigator assistant inside Research Nexus.
The researcher is exploring: "${seedTopic}"

Clusters in their research map:
${clusterList}

Excluded by researcher:
${prunedList}

Research directions generated:
${directionList}
${selInfo ? '\n' + selInfo : ''}

Help the researcher understand their map, identify gaps, compare clusters, and plan next steps. Be specific — reference actual cluster names. Keep responses to 2–4 sentences unless more depth is needed.

Respond with valid JSON only:
{"text": "your response", "action": null}

Optionally, if the researcher would benefit from a refined search query, include:
{"text": "your response", "action": {"type": "suggest_reframe", "newTopic": "refined query", "reason": "why this would improve results"}}

Only suggest a reframe when the current map seems too broad, too narrow, or misaligned with the question. Never include an action unless it genuinely helps.

GRAPH EDITING — only when the researcher explicitly asks you to change the map (e.g. "add a cluster for X", "connect A and B", "remove the Y cluster", "drop the link between A and B"). Propose up to 3 reviewable edits via "graphActions". The user always previews and approves before anything is applied. Never edit unprompted.

Existing node ids you may target (use the exact id):
${clusterRefList}

Edit shapes (each needs "confidence" 0–1 and a short "reason"):
{"type":"add_node","nodeType":"cluster","label":"...","description":"...","confidence":0.0,"reason":"..."}
{"type":"remove_node","targetId":"<existing id>","confidence":0.0,"reason":"..."}
{"type":"add_edge","sourceId":"<id>","targetId":"<id>","edgeType":"semantic_similarity","confidence":0.0,"reason":"..."}
{"type":"remove_edge","edgeId":"<edge id>","confidence":0.0,"reason":"..."}

Use real ids from the list above for removals and edges. Be conservative with confidence — below 0.5 means speculative. Full response shape:
{"text":"...","action":null,"graphActions":[ ... ]}`

    const userAnthropicKey = req.headers.get('x-anthropic-key') || null
    let text = ''
    let action: z.infer<typeof ResponseSchema>['action'] = null
    let graphActions: z.infer<typeof GraphActionSchema>[] = []

    function parseJSON(raw: string) {
      try {
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) return { text: raw, action: null, graphActions: [] }
        const parsed = ResponseSchema.safeParse(JSON.parse(match[0]))
        if (parsed.success) {
          return {
            text: parsed.data.text,
            action: parsed.data.action ?? null,
            // Hard cap: never surface more than 3 edits at once.
            graphActions: (parsed.data.graphActions ?? []).slice(0, 3),
          }
        }
        return { text: raw, action: null, graphActions: [] }
      } catch {
        return { text: raw, action: null, graphActions: [] }
      }
    }

    if (userAnthropicKey) {
      const client = new Anthropic({ apiKey: userAnthropicKey })
      const resp = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
          { role: 'user' as const, content: message },
        ],
      })
      const raw = resp.content.find(b => b.type === 'text')?.text ?? ''
      ;({ text, action, graphActions } = parseJSON(raw))
    } else {
      const groqKey = process.env.GROQ_API_KEY
      if (!groqKey) return Response.json({ text: 'AI unavailable — no API key configured.', action: null })
      const client = new Groq({ apiKey: groqKey })
      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
          { role: 'user', content: message },
        ],
        temperature: 0.5,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      })
      const raw = completion.choices[0].message.content ?? ''
      ;({ text, action, graphActions } = parseJSON(raw))
    }

    void sessionId
    return Response.json({ text, action, graphActions })
  } catch (err) {
    console.error('[api/chat]', err)
    const status = (err as { status?: number }).status
    if (status === 429 || status === 529) {
      return Response.json({ text: 'AI is at capacity right now — try again in a moment.', action: null })
    }
    return Response.json({ text: 'Something went wrong. Please try again.', action: null })
  }
}
