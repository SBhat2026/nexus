import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * POST /api/session/[id]/curation
 *
 * Bulk-reconcile the session's prune/flag state in human_actions to exactly the
 * supplied sets. Used by undo/redo and revert so a cold DB reload matches whatever
 * graph state the client restored. Replaces, not merges.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params
    const body = await req.json()
    const prunedClusterIds: string[] = Array.isArray(body.prunedClusterIds) ? body.prunedClusterIds : []
    const pruneReasons: Record<string, string> = body.pruneReasons ?? {}
    const flaggedNodeIds: string[] = Array.isArray(body.flaggedNodeIds) ? body.flaggedNodeIds : []

    if (!sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 })

    const db = createServerClient()

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
      const { error } = await db.from('human_actions').insert(rows)
      if (error) return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[session/curation]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
