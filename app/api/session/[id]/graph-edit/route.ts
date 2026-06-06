import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'
import type { GraphEditAction, GraphEditResult, GraphNode, GraphEdge, ClusterNode, PaperNode } from '@/lib/types'

// Raised 3 → 8 so a single instruction ("rename X, drop A/B/C, add Z") applies
// as one reviewed batch instead of being truncated.
const MAX_ACTIONS = 8
// Raised from 50 → 200 to match the client. 50 was too low for real research
// sessions; the D3 force sim handles 200 nodes comfortably.
const MAX_NODES = 200
const MAX_LABEL = 60

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
      db.from('clusters').select('id, label, paper_count').eq('session_id', sessionId),
      db.from('papers').select('id, is_outlier, cluster_id').eq('session_id', sessionId),
      db.from('direction_nodes').select('id').eq('session_id', sessionId),
    ])
    const clusterIds = new Set((clustersRes.data ?? []).map((c) => c.id))
    const paperIds = new Set((papersRes.data ?? []).map((p) => p.id))
    const outlierIds = new Set((papersRes.data ?? []).filter((p) => p.is_outlier).map((p) => p.id))
    const directionIds = new Set((directionsRes.data ?? []).map((d) => d.id))
    const labels = new Set((clustersRes.data ?? []).map((c) => (c.label ?? '').trim().toLowerCase()))

    // Where each paper currently lives + each cluster's stored count, so paper
    // moves/adds/removes keep the denormalized paper_count accurate.
    const paperCluster = new Map<string, string | null>(
      (papersRes.data ?? []).map((p) => [p.id, p.cluster_id ?? null]),
    )
    const clusterCount = new Map<string, number>(
      (clustersRes.data ?? []).map((c) => [c.id, c.paper_count ?? 0]),
    )
    // Net change to each cluster's paper_count over this batch.
    const countDelta = new Map<string, number>()
    const bumpCount = (cid: string | null, by: number) => {
      if (cid && clusterIds.has(cid)) countDelta.set(cid, (countDelta.get(cid) ?? 0) + by)
    }

    let nodeCount = clusterIds.size + paperIds.size + directionIds.size

    const typeOf = (nid: string): string | null =>
      clusterIds.has(nid) ? 'cluster'
        : outlierIds.has(nid) ? 'outlier'
        : paperIds.has(nid) ? 'paper'
        : directionIds.has(nid) ? 'direction'
        : null

    const result: GraphEditResult = { addedNodes: [], addedEdges: [], removedNodeIds: [], removedEdgeIds: [], updatedNodes: [], skipped: [] }
    const audit: { session_id: string; action_type: string; target_id: string; target_type: string; note: string; metadata: unknown }[] = []

    for (const a of actions) {
      if (a.type === 'add_node') {
        const label = (a.label ?? '').trim()
        if (!label) { result.skipped.push({ action: a, reason: 'Empty label' }); continue }
        if (nodeCount >= MAX_NODES) { result.skipped.push({ action: a, reason: `Session node limit (${MAX_NODES}) reached` }); continue }

        const newId = randomUUID()

        if (a.nodeType === 'paper') {
          // Optionally attach to an existing cluster; ignore bogus ids.
          const clusterId = a.clusterId && clusterIds.has(a.clusterId) ? a.clusterId : null
          const { error } = await db.from('papers').insert({
            id: newId, session_id: sessionId, s2_paper_id: `ai:${newId}`,
            title: label, abstract: a.description ?? null, authors: [], year: null,
            citation_count: 0, cluster_id: clusterId, is_outlier: false,
          })
          if (error) { result.skipped.push({ action: a, reason: error.message }); continue }

          paperIds.add(newId)
          paperCluster.set(newId, clusterId)
          bumpCount(clusterId, +1)
          nodeCount++
          const node: PaperNode = {
            id: newId, nodeType: 'paper', s2PaperId: `ai:${newId}`, title: label,
            abstract: a.description ?? '', authors: [], year: 0, citationCount: 0,
            clusterId, isOutlier: false,
          }
          result.addedNodes.push(node as GraphNode)
          audit.push({ session_id: sessionId, action_type: 'generate', target_id: newId, target_type: 'paper', note: a.reason, metadata: { ai_edit: 'add_node', label, confidence: a.confidence } })
          continue
        }

        // cluster
        if (labels.has(label.toLowerCase())) { result.skipped.push({ action: a, reason: 'Duplicate label' }); continue }
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

        // Remove connected edges first; report them so the client prunes them too.
        const { data: connEdges } = await db.from('edges').select('id')
          .eq('session_id', sessionId)
          .or(`source_id.eq.${a.targetId},target_id.eq.${a.targetId}`)
        await db.from('edges').delete().eq('session_id', sessionId).or(`source_id.eq.${a.targetId},target_id.eq.${a.targetId}`)
        for (const e of connEdges ?? []) result.removedEdgeIds.push(e.id)

        const table = t === 'cluster' ? 'clusters'
          : (t === 'paper' || t === 'outlier') ? 'papers'
          : 'direction_nodes'
        const { error } = await db.from(table).delete().eq('id', a.targetId).eq('session_id', sessionId)
        if (error) { result.skipped.push({ action: a, reason: error.message }); continue }

        if (t === 'cluster') clusterIds.delete(a.targetId)
        else if (t === 'paper' || t === 'outlier') {
          bumpCount(paperCluster.get(a.targetId) ?? null, -1)
          paperCluster.delete(a.targetId)
          paperIds.delete(a.targetId); outlierIds.delete(a.targetId)
        }
        else directionIds.delete(a.targetId)
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

      else if (a.type === 'rename_cluster') {
        if (!clusterIds.has(a.targetId)) { result.skipped.push({ action: a, reason: 'Cluster not found' }); continue }
        const newLabel = (a.newLabel ?? '').trim().slice(0, MAX_LABEL)
        if (!newLabel) { result.skipped.push({ action: a, reason: 'Empty label' }); continue }
        if (labels.has(newLabel.toLowerCase())) { result.skipped.push({ action: a, reason: 'Duplicate label' }); continue }
        // custom_label takes precedence over the AI label everywhere it's rendered.
        const { error } = await db.from('clusters').update({ custom_label: newLabel }).eq('id', a.targetId).eq('session_id', sessionId)
        if (error) { result.skipped.push({ action: a, reason: error.message }); continue }
        labels.add(newLabel.toLowerCase())
        result.updatedNodes.push({ id: a.targetId, changes: { label: newLabel } })
        audit.push({ session_id: sessionId, action_type: 'generate', target_id: a.targetId, target_type: 'cluster', note: a.reason, metadata: { ai_edit: 'rename_cluster', label: newLabel, confidence: a.confidence } })
      }

      else if (a.type === 'assign_paper') {
        const t = typeOf(a.paperId)
        if (t !== 'paper' && t !== 'outlier') { result.skipped.push({ action: a, reason: 'Paper not found' }); continue }
        const dest = a.clusterId && clusterIds.has(a.clusterId) ? a.clusterId : null
        if (a.clusterId && !dest) { result.skipped.push({ action: a, reason: 'Target cluster not found' }); continue }
        const from = paperCluster.get(a.paperId) ?? null
        if (from === dest) { result.skipped.push({ action: a, reason: 'Already in that cluster' }); continue }
        const { error } = await db.from('papers').update({ cluster_id: dest }).eq('id', a.paperId).eq('session_id', sessionId)
        if (error) { result.skipped.push({ action: a, reason: error.message }); continue }
        bumpCount(from, -1)
        bumpCount(dest, +1)
        paperCluster.set(a.paperId, dest)
        result.updatedNodes.push({ id: a.paperId, changes: { clusterId: dest } })
        audit.push({ session_id: sessionId, action_type: 'generate', target_id: a.paperId, target_type: t, note: a.reason, metadata: { ai_edit: 'assign_paper', from, to: dest, confidence: a.confidence } })
      }
    }

    // Flush accumulated paper_count changes; reflect the new totals on cluster nodes.
    for (const [cid, delta] of countDelta) {
      if (delta === 0) continue
      const next = Math.max(0, (clusterCount.get(cid) ?? 0) + delta)
      const { error } = await db.from('clusters').update({ paper_count: next }).eq('id', cid).eq('session_id', sessionId)
      if (!error) result.updatedNodes.push({ id: cid, changes: { paperCount: next } })
    }

    if (audit.length) { await db.from('human_actions').insert(audit) }

    return Response.json(result)
  } catch (err) {
    console.error('[session/graph-edit]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
