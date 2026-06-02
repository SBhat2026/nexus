import { NextRequest } from 'next/server'
import { createAuthClient } from '@/utils/supabase/server'
import { createServerClient } from '@/lib/supabase/server'

// Delete a session the caller owns. Cascades to papers/clusters/edges/
// human_actions/direction_nodes/session_snapshots via ON DELETE CASCADE.
export async function DELETE(
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

  // Only allow deleting a session the user owns.
  const { data: session } = await db
    .from('sessions')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()

  if (!session || session.user_id !== user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await db.from('sessions').delete().eq('id', id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
