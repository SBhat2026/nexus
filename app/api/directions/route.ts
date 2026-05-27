import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'
import { generateDirectionsClaude } from '@/lib/anthropic/generateDirections'
import { generateDirectionsGroq } from '@/lib/groq/generateDirections'
import type { DirectionDraft, DirectionsResult, ClusterContext } from '@/lib/anthropic/generateDirections'
import type { DirectionNode, GraphEdge } from '@/lib/types'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sessionId: string = body.sessionId ?? ''
    const clusterIds: string[] = body.clusterIds ?? []
    const outlierId: string | null = body.outlierId ?? null
    const prunedClusters: { id: string; label: string; reason: string }[] = body.prunedClusters ?? []
    const outlierFlagNote: string | null = body.outlierFlagNote ?? null
    // Client-provided cluster context — used as fallback when DB rows are missing
    const clientClusterContexts: { clusterId: string; label: string; description: string; paperCount: number; papers: { title: string; abstract: string; year: number; citationCount: number }[] }[] = body.clusterContexts ?? []

    if (!sessionId || (clusterIds.length === 0 && !outlierId)) {
      return Response.json({ error: 'sessionId and either clusterIds or outlierId required' }, { status: 400 })
    }

    const userAnthropicKey = req.headers.get('x-anthropic-key') || null

    const db = createServerClient()
    let clusters: ClusterContext[]

    if (outlierId) {
      const { data: outlierRow } = await db
        .from('papers')
        .select('id, title, abstract, cluster_id')
        .eq('id', outlierId)
        .eq('session_id', sessionId)
        .single()

      if (!outlierRow) return Response.json({ error: 'Outlier not found' }, { status: 404 })

      const nearestClusterId = outlierRow.cluster_id
      let clusterContext = { id: outlierId, label: 'Unclustered', description: '', cluster_quality: null as number | null }
      let clusterPapers: ClusterContext['papers'] = []

      if (nearestClusterId) {
        const { data: clusterRow } = await db
          .from('clusters')
          .select('id, label, description, cluster_quality')
          .eq('id', nearestClusterId)
          .eq('session_id', sessionId)
          .single()
        if (clusterRow) {
          clusterContext = clusterRow
          const { data: repPapers } = await db
            .from('papers')
            .select('title, abstract, year, citation_count')
            .eq('cluster_id', nearestClusterId)
            .eq('session_id', sessionId)
            .eq('is_representative', true)
            .limit(3)
          clusterPapers = (repPapers ?? []).map((p: { title: string; abstract: string; year: number; citation_count: number }) => ({
            title: p.title,
            abstract: p.abstract ?? '',
            year: p.year,
            citationCount: p.citation_count,
          }))
        }
      }

      clusters = [{
        clusterId: outlierId,
        label: clusterContext.label,
        description: clusterContext.description,
        confidenceScore: clusterContext.cluster_quality ?? undefined,
        papers: clusterPapers,
        outlierPaper: {
          title: outlierRow.title,
          abstract: outlierRow.abstract ?? '',
          partialOverlapClusters: nearestClusterId ? [clusterContext.label] : [],
          flagNote: outlierFlagNote ?? undefined,
        },
      }]
    } else {
      let clusterRows: { id: string; label: string; description: string; paper_count: number; cluster_quality?: number | null }[] | null = null
      const { data: fullRows, error: fetchErr } = await db
        .from('clusters')
        .select('id, label, description, paper_count, cluster_quality')
        .in('id', clusterIds)
        .eq('session_id', sessionId)

      if (fetchErr) {
        // cluster_quality column may not exist — retry without it
        const { data: fallbackRows } = await db
          .from('clusters')
          .select('id, label, description, paper_count')
          .in('id', clusterIds)
          .eq('session_id', sessionId)
        clusterRows = fallbackRows
      } else {
        clusterRows = fullRows
      }

      if (!clusterRows || clusterRows.length === 0) {
        if (clientClusterContexts.length > 0) {
          // DB rows missing (schema issue or old session) — use client-provided context
          clusters = clientClusterContexts.map((c) => ({
            clusterId: c.clusterId,
            label: c.label,
            description: c.description ?? '',
            paperCount: c.paperCount,
            papers: c.papers,
          }))
        } else {
          return Response.json({ error: 'Clusters not found' }, { status: 404 })
        }
      } else {
        const { data: paperRows } = await db
          .from('papers')
          .select('id, title, abstract, year, citation_count, cluster_id')
          .in('cluster_id', clusterIds)
          .eq('session_id', sessionId)
          .eq('is_representative', true)

        clusters = clusterRows.map((c: { id: string; label: string; description: string; paper_count: number; cluster_quality?: number | null }) => ({
          clusterId: c.id,
          label: c.label,
          description: c.description ?? '',
          paperCount: c.paper_count,
          confidenceScore: c.cluster_quality ?? undefined,
          sharedMethodology: c.description ?? undefined,
          papers: (paperRows ?? [])
            .filter((p: { cluster_id: string }) => p.cluster_id === c.id)
            .slice(0, 3)
            .map((p: { title: string; abstract: string; year: number; citation_count: number }) => ({
              title: p.title,
              abstract: p.abstract ?? '',
              year: p.year,
              citationCount: p.citation_count,
            })),
        }))
      }

      // Append pruned cluster context (not queried — taken from client state)
      if (prunedClusters.length > 0) {
        for (const pc of prunedClusters) {
          clusters.push({
            clusterId: pc.id,
            label: pc.label,
            description: '',
            papers: [],
            isPruned: true,
            pruneReason: pc.reason,
          })
        }
      }
    }

    // Use Claude with user's BYOK key, else fall back to Groq
    let result: DirectionsResult
    if (userAnthropicKey) {
      result = await generateDirectionsClaude(clusters, userAnthropicKey)
    } else {
      result = await generateDirectionsGroq(clusters)
    }

    if (!result.ai_available) {
      return Response.json({
        directions: [],
        edges: [],
        ai_available: false,
        reason: result.reason,
      })
    }

    const drafts: DirectionDraft[] = result.drafts

    const directionRows = drafts.map((d) => ({
      id: randomUUID(),
      session_id: sessionId,
      parent_cluster_id: d.parentClusterId,
      title: d.title,
      description: d.description,
      rationale: d.rationale,
      novelty_score: d.noveltyScore,
      feasibility_score: d.feasibilityScore,
      suggested_next_steps: d.suggestedNextSteps,
      is_flagged: false,
      human_rating: null,
    }))

    await db.from('directions').insert(directionRows)

    const edgeRows = directionRows.map((dr) => ({
      session_id: sessionId,
      source_id: dr.parent_cluster_id,
      source_type: outlierId ? 'paper' : 'cluster',
      target_id: dr.id,
      target_type: 'direction',
      weight: 1,
      edge_type: 'generated_from',
    }))
    await db.from('edges').insert(edgeRows)

    const directions: DirectionNode[] = directionRows.map((dr, i) => ({
      id: dr.id,
      nodeType: 'direction',
      title: dr.title,
      description: dr.description ?? '',
      noveltyScore: dr.novelty_score ?? 5,
      feasibilityScore: dr.feasibility_score ?? 5,
      parentClusterId: dr.parent_cluster_id,
      isFlagged: false,
      humanRating: null,
      rationale: dr.rationale ?? undefined,
      suggestedNextSteps: drafts[i].suggestedNextSteps,
    }))

    const edges: GraphEdge[] = directionRows.map((dr) => ({
      id: `e-dir-${dr.id}`,
      source: dr.parent_cluster_id,
      target: dr.id,
      edgeType: 'generated_from',
      weight: 1,
    }))

    return Response.json({ directions, edges, ai_available: true })
  } catch (err) {
    console.error('[api/directions]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
