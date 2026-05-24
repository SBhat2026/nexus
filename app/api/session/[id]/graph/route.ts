import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { GraphData, PaperNode, ClusterNode, OutlierNode, GraphEdge } from '@/lib/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params
    const db = createServerClient()

    // Fetch all session data in parallel
    const [sessionRes, papersRes, clustersRes, edgesRes, actionsRes] = await Promise.all([
      db.from('sessions').select('*').eq('id', sessionId).single(),
      db.from('papers').select('*').eq('session_id', sessionId),
      db.from('clusters').select('*').eq('session_id', sessionId),
      db.from('edges').select('*').eq('session_id', sessionId),
      db.from('human_actions').select('*').eq('session_id', sessionId).order('created_at'),
    ])

    if (sessionRes.error || !sessionRes.data) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    // Build pruned and flagged sets from human actions
    const prunedClusters = new Set<string>()
    const flaggedNodes = new Set<string>()
    const pruneReasons = new Map<string, string>()
    ;(actionsRes.data ?? []).forEach((a) => {
      if (a.action_type === 'prune') { prunedClusters.add(a.target_id); pruneReasons.set(a.target_id, a.note ?? '') }
      if (a.action_type === 'flag') flaggedNodes.add(a.target_id)
    })

    const nodes: GraphData['nodes'] = []

    // Cluster nodes
    ;(clustersRes.data ?? []).forEach((c) => {
      const clusterNode: ClusterNode = {
        id: c.id,
        nodeType: 'cluster',
        label: c.label,
        description: c.description ?? '',
        paperCount: c.paper_count,
        field: c.field ?? 'default',
        isPruned: prunedClusters.has(c.id) || c.is_pruned,
        pruneReason: pruneReasons.get(c.id) ?? c.prune_reason ?? undefined,
      }
      nodes.push(clusterNode)
    })

    // Paper and outlier nodes
    ;(papersRes.data ?? []).forEach((p) => {
      if (p.is_outlier) {
        const o: OutlierNode = {
          id: p.id,
          nodeType: 'outlier',
          s2PaperId: p.s2_paper_id,
          title: p.title,
          abstract: p.abstract ?? '',
          authors: p.authors ?? [],
          year: p.year ?? 0,
          citationCount: p.citation_count,
          mahalanobisDistance: 0,
          nearestClusterId: p.cluster_id ?? '',
          overlapClusterIds: p.cluster_id ? [p.cluster_id] : [],
          isFlagged: flaggedNodes.has(p.id),
        }
        nodes.push(o)
      } else {
        const paper: PaperNode = {
          id: p.id,
          nodeType: 'paper',
          s2PaperId: p.s2_paper_id,
          title: p.title,
          abstract: p.abstract ?? '',
          authors: p.authors ?? [],
          year: p.year ?? 0,
          citationCount: p.citation_count,
          clusterId: p.cluster_id,
          isOutlier: false,
          tldr: p.tldr ?? undefined,
          s2Url: p.s2_url ?? undefined,
        }
        nodes.push(paper)
      }
    })

    const edges: GraphEdge[] = (edgesRes.data ?? []).map((e) => ({
      id: e.id,
      source: e.source_id,
      target: e.target_id,
      edgeType: e.edge_type as GraphEdge['edgeType'],
      weight: e.weight,
    }))

    return Response.json({ sessionId, seedTopic: sessionRes.data.seed_topic, graph: { nodes, edges } })
  } catch (err) {
    console.error('[session/graph]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
