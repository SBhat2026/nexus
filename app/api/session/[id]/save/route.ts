import { NextRequest } from 'next/server'
import { createAuthClient } from '@/utils/supabase/server'
import { createServerClient } from '@/lib/supabase/server'

// Non-admin users may keep at most this many saved sessions. When a save pushes
// the count past the cap, the oldest saved sessions are deleted (FIFO). The admin
// (profiles.is_admin = true) is exempt and may save unlimited sessions.
const SESSION_CAP = 10

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

  // Enforce the saved-session cap for non-admins.
  let deleted: string[] = []
  const { data: profile } = await db
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    const { data: saved } = await db
      .from('sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_saved', true)
      .order('created_at', { ascending: false })

    if (saved && saved.length > SESSION_CAP) {
      // Keep the SESSION_CAP most recent; delete the rest (cascades to children).
      const toDelete = saved.slice(SESSION_CAP).map((s) => s.id)
      const { error: delErr } = await db
        .from('sessions')
        .delete()
        .in('id', toDelete)
      if (!delErr) deleted = toDelete
    }
  }

  return Response.json({ ok: true, deleted, cap: SESSION_CAP })
}
