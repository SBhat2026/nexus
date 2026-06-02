import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'
import type { GraphEditAction, GraphEditResult, GraphNode, GraphEdge, ClusterNode } from '@/lib/types'

const MAX_ACTIONS = 3
const MAX_NODES = 50

/**
 * POST /api/session/[id]/graph-edit
 *
 * Validates and applies a batch of AI-proposed graph edits to the normalized tables,
 * then returns the diff for the client to merge. All limits are enforced here
 * regardless of client guards. Each applied edit is logged to human_actions (audit).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params
    const body = await req.json()
    const incoming = (Array.isArray(body.actions) ? body.actions : []) as GraphEditAction[]
    if (!sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 })

    const actions = incoming.slice(0, MAX_ACTIONS) // hard server cap
    const db = createServerClient()

    // Load existing ids for validation, node typing, and the node-count limit.
    const [clustersRes, papersRes, directionsRes] = await Promise.all([
      db.from('clusters').select('id, label').eq('session_id', sessionId),
      db.from('papers').select('id, is_outlier').eq('session_id', sessionId),
      db.from('direction_nodes').select('id').eq('session_id', sessionId),
    ])
    const clusterIds = new Set((clustersRes.data ?? []).map((c) => c.id))
    const paperIds = new Set((papersRes.data ?? []).map((p) => p.id))
    const outlierIds = new Set((papersRes.data ?? []).filter((p) => p.is_outlier).map((p) => p.id))
    const directionIds = new Set((directionsRes.data ?? []).map((d) => d.id))
    const labels = new Set((clustersRes.data ?? []).map((c) => (c.label ?? '').trim().toLowerCase()))

    let nodeCount = clusterIds.size + paperIds.size + directionIds.size

    const typeOf = (nid: string): string | null =>
      clusterIds.has(nid) ? 'cluster'
        : outlierIds.has(nid) ? 'outlier'
        : paperIds.has(nid) ? 'paper'
        : directionIds.has(nid) ? 'direction'
        : null

    const result: GraphEditResult = { addedNodes: [], addedEdges: [], removedNodeIds: [], removedEdgeIds: [], skipped: [] }
    const audit: { session_id: string; action_type: string; target_id: string; target_type: string; note: string; metadata: unknown }[] = []

    for (const a of actions) {
      if (a.type === 'add_node') {
        const label = (a.label ?? '').trim()
        if (!label) { result.skipped.push({ action: a, reason: 'Empty label' }); continue }
        if (labels.has(label.toLowerCase())) { result.skipped.push({ action: a, reason: 'Duplicate label' }); continue }
        if (nodeCount >= MAX_NODES) { result.skipped.push({ action: a, reason: `Session node limit (${MAX_NODES}) reached` }); continue }

        const newId = randomUUID()
        const { error } = await db.from('clusters').insert({
          id: newId, session_id: sessionId, label, description: a.description ?? null,
          paper_count: 0, field: 'ai', is_pruned: false,
        })
        if (error) { result.skipped.push({ action: a, reason: error.message }); continue }

        labels.add(label.toLowerCase())
        clusterIds.add(newId)
        nodeCount++
        const node: ClusterNode = {
          id: newId, nodeType: 'cluster', label, description: a.description ?? '',
          paperCount: 0, field: 'ai', isPruned: false,
        }
        result.addedNodes.push(node as GraphNode)
        audit.push({ session_id: sessionId, action_type: 'generate', target_id: newId, target_type: 'cluster', note: a.reason, metadata: { ai_edit: 'add_node', label, confidence: a.confidence } })
      }

      else if (a.type === 'remove_node') {
        const t = typeOf(a.targetId)
        if (!t) { result.skipped.push({ action: a, reason: 'Node not found' }); continue }
        if (t === 'paper' || t === 'outlier') { result.skipped.push({ action: a, reason: 'Papers are evidence and cannot be removed' }); continue }

        // Remove connected edges first; report them so the client prunes them too.
        const { data: connEdges } = await db.from('edges').select('id')
          .eq('session_id', sessionId)
          .or(`source_id.eq.${a.targetId},target_id.eq.${a.targetId}`)
        await db.from('edges').delete().eq('session_id', sessionId).or(`source_id.eq.${a.targetId},target_id.eq.${a.targetId}`)
        for (const e of connEdges ?? []) result.removedEdgeIds.push(e.id)

        const table = t === 'cluster' ? 'clusters' : 'direction_nodes'
        const { error } = await db.from(table).delete().eq('id', a.targetId).eq('session_id', sessionId)
        if (error) { result.skipped.push({ action: a, reason: error.message }); continue }

        if (t === 'cluster') clusterIds.delete(a.targetId); else directionIds.delete(a.targetId)
        nodeCount--
        result.removedNodeIds.push(a.targetId)
        audit.push({ session_id: sessionId, action_type: 'generate', target_id: a.targetId, target_type: t, note: a.reason, metadata: { ai_edit: 'remove_node', confidence: a.confidence } })
      }

      else if (a.type === 'add_edge') {
        const st = typeOf(a.sourceId)
        const tt = typeOf(a.targetId)
        if (!st || !tt) { result.skipped.push({ action: a, reason: 'Edge endpoint not found' }); continue }
        if (a.sourceId === a.targetId) { result.skipped.push({ action: a, reason: 'Self-loop' }); continue }
        const edgeType = a.edgeType ?? 'semantic_similarity'
        const newId = randomUUID()
        const { error } = await db.from('edges').insert({
          id: newId, session_id: sessionId, source_id: a.sourceId, source_type: st,
          target_id: a.targetId, target_type: tt, weight: 1.0, edge_type: edgeType,
        })
        if (error) { result.skipped.push({ action: a, reason: error.message }); continue }
        const edge: GraphEdge = { id: newId, source: a.sourceId, target: a.targetId, edgeType, weight: 1.0 }
        result.addedEdges.push(edge)
        audit.push({ session_id: sessionId, action_type: 'generate', target_id: newId, target_type: 'edge', note: a.reason, metadata: { ai_edit: 'add_edge', source: a.sourceId, target: a.targetId, confidence: a.confidence } })
      }

      else if (a.type === 'remove_edge') {
        const { error } = await db.from('edges').delete().eq('id', a.edgeId).eq('session_id', sessionId)
        if (error) { result.skipped.push({ action: a, reason: error.message }); continue }
        result.removedEdgeIds.push(a.edgeId)
        audit.push({ session_id: sessionId, action_type: 'generate', target_id: a.edgeId, target_type: 'edge', note: a.reason, metadata: { ai_edit: 'remove_edge', confidence: a.confidence } })
      }
    }

    if (audit.length) { await db.from('human_actions').insert(audit) }

    return Response.json(result)
  } catch (err) {
    console.error('[session/graph-edit]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
