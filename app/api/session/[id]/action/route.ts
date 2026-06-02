import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Persist a human curation action (prune / unprune / flag / unflag) to the DB so it
 * survives reload and restores cross-device. The graph is the source of truth in the
 * normalized tables; these rows live in `human_actions` and are replayed by
 * GET /api/session/[id]/graph.
 *
 * Uses delete-then-insert (no upsert) so it does not depend on a unique constraint.
 */

type ActionType = 'prune' | 'unprune' | 'flag' | 'unflag'

const PERSISTED: Record<ActionType, { write: 'prune' | 'flag' | null }> = {
  prune: { write: 'prune' },
  unprune: { write: null },
  flag: { write: 'flag' },
  unflag: { write: null },
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params
    const body = await req.json()
    const action: ActionType = body.action
    const targetId: string = body.targetId ?? ''
    const targetType: string = body.targetType ?? 'cluster'
    const note: string | null = typeof body.note === 'string' ? body.note : null

    if (!sessionId || !targetId || !(action in PERSISTED)) {
      return Response.json({ error: 'sessionId, targetId and valid action required' }, { status: 400 })
    }

    // prune/unprune toggle the same 'prune' row; flag/unflag toggle the 'flag' row.
    const baseType = action === 'prune' || action === 'unprune' ? 'prune' : 'flag'
    const db = createServerClient()

    // Always clear any existing row for this (session, action, target) first — idempotent.
    await db
      .from('human_actions')
      .delete()
      .eq('session_id', sessionId)
      .eq('action_type', baseType)
      .eq('target_id', targetId)

    const writeType = PERSISTED[action].write
    if (writeType) {
      const { error } = await db.from('human_actions').insert({
        session_id: sessionId,
        action_type: writeType,
        target_id: targetId,
        target_type: targetType,
        note,
      })
      if (error) return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[session/action]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
