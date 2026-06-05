import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * POST /api/session/[id]/touch
 * Body (all optional): { chatHistory?: {role,content}[] }
 *
 * Incremental auto-save. Bumps `updated_at` (so the session sorts to the top of
 * /sessions and is recognised as freshly worked on) and `last_seen_at` (so the
 * stale-session cron won't reap in-progress work). Cluster labels, direction
 * nodes and pruning are already persisted in their own tables on each action;
 * the only thing without a normalized home is the chat transcript, stored here.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    let chatHistory: unknown = undefined
    try {
      const body = await req.json()
      chatHistory = body?.chatHistory
    } catch {}

    const now = new Date().toISOString()
    const patch: Record<string, unknown> = { updated_at: now, last_seen_at: now }
    if (Array.isArray(chatHistory)) {
      // Cap stored transcript to keep the row small.
      patch.chat_history = chatHistory.slice(-100)
    }

    const db = createServerClient()
    const { error } = await db.from('sessions').update(patch).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, at: now })
  } catch (err) {
    console.error('[session/touch]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
