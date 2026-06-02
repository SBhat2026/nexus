import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { GraphData, GraphNode } from '@/lib/types'

/**
 * POST /api/session/[id]/snapshots/[version]/revert
 *
 * Restores the graph captured by snapshot `version`. To preserve history this
 * branches: a new head snapshot (origin 'revert', parent_version = version) is
 * written rather than deleting anything. Curation (prune/flag) in human_actions is
 * reconciled to match the snapshot so a cold DB reload stays consistent.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  try {
    const { id: sessionId, version: versionStr } = await params
    const version = parseInt(versionStr, 10)
    if (!sessionId || Number.isNaN(version)) {
      return Response.json({ error: 'sessionId and numeric version required' }, { status: 400 })
    }

    const db = createServerClient()

    const { data: snap, error: snapErr } = await db
      .from('session_snapshots')
      .select('graph, version')
      .eq('session_id', sessionId)
      .eq('version', version)
      .maybeSingle()

    if (snapErr) return Response.json({ error: snapErr.message }, { status: 500 })
    if (!snap) return Response.json({ error: 'Snapshot not found' }, { status: 404 })

    const graph = snap.graph as GraphData

    // Derive curation state from the snapshot's node flags.
    const prunedClusterIds: string[] = []
    const pruneReasons: Record<string, string> = {}
    const flaggedNodeIds: string[] = []
    for (const n of graph.nodes as GraphNode[]) {
      if (n.nodeType === 'cluster' && (n as { isPruned?: boolean }).isPruned) {
        prunedClusterIds.push(n.id)
        const r = (n as { pruneReason?: string }).pruneReason
        if (r) pruneReasons[n.id] = r
      }
      if ((n as { isFlagged?: boolean }).isFlagged) flaggedNodeIds.push(n.id)
    }

    // Reconcile human_actions: clear existing prune/flag, then re-insert from snapshot.
    await db
      .from('human_actions')
      .delete()
      .eq('session_id', sessionId)
      .in('action_type', ['prune', 'flag'])

    const rows = [
      ...prunedClusterIds.map((tid) => ({
        session_id: sessionId, action_type: 'prune', target_id: tid,
        target_type: 'cluster', note: pruneReasons[tid] ?? null,
      })),
      ...flaggedNodeIds.map((tid) => ({
        session_id: sessionId, action_type: 'flag', target_id: tid,
        target_type: 'outlier', note: null,
      })),
    ]
    if (rows.length) {
      const { error: insErr } = await db.from('human_actions').insert(rows)
      if (insErr) return Response.json({ error: insErr.message }, { status: 500 })
    }

    // Branch: write a new head snapshot pointing back at the reverted version.
    const { data: maxRow } = await db
      .from('session_snapshots')
      .select('version')
      .eq('session_id', sessionId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    const newVersion = (maxRow?.version ?? version) + 1

    const { data: head, error: headErr } = await db
      .from('session_snapshots')
      .insert({
        session_id: sessionId,
        version: newVersion,
        parent_version: version,
        label: `Reverted to v${version}`,
        origin: 'revert',
        graph,
        node_count: graph.nodes.length,
        edge_count: graph.edges.length,
      })
      .select('id, version, parent_version, label, origin, node_count, edge_count, created_at')
      .single()

    if (headErr) return Response.json({ error: headErr.message }, { status: 500 })

    return Response.json({
      ok: true,
      graph,
      snapshot: head,
      prunedClusterIds,
      pruneReasons,
      flaggedNodeIds,
    })
  } catch (err) {
    console.error('[snapshots/revert]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
