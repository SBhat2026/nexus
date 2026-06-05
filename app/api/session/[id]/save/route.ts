import { NextRequest } from 'next/server'
import { createAuthClient } from '@/utils/supabase/server'
import { createServerClient } from '@/lib/supabase/server'
import { enforceSessionCap, SESSION_CAP } from '@/lib/sessions/cap'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServerClient()
  // Claim only sessions that are unowned or already this user's (no hijacking by id),
  // mark saved, and bump updated_at so it sorts to the top of /sessions.
  const { data: updated, error } = await db
    .from('sessions')
    .update({ is_saved: true, user_id: user.id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .select('id')

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!updated || updated.length === 0) {
    return Response.json({ error: 'Session not found or not owned by you' }, { status: 404 })
  }

  // Enforce the saved-session cap for non-admins (FIFO, cascades to children).
  const deleted = await enforceSessionCap(db, user.id)

  return Response.json({ ok: true, deleted, cap: SESSION_CAP })
}
