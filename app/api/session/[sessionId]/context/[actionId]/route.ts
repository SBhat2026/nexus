import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAuthClient } from '@/utils/supabase/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; actionId: string }> }
) {
  const { sessionId, actionId } = await params

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServerClient()

  // Verify ownership: user_id on the row must match
  const { data: row } = await db
    .from('human_actions')
    .select('user_id')
    .eq('id', actionId)
    .eq('session_id', sessionId)
    .single()

  if (!row) return Response.json({ error: 'Not found' }, { status: 404 })
  if (row.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await db
    .from('human_actions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', actionId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
