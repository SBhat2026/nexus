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
  const { error } = await db
    .from('sessions')
    .update({ is_saved: true, user_id: user.id })
    .eq('id', id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Enforce the saved-session cap for non-admins (FIFO, cascades to children).
  const deleted = await enforceSessionCap(db, user.id)

  return Response.json({ ok: true, deleted, cap: SESSION_CAP })
}
