import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAuthClient } from '@/utils/supabase/server'
import { randomUUID } from 'crypto'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const db = createServerClient()
  const { data, error } = await db
    .from('human_actions')
    .select('id, target_id, target_type, note, metadata, created_at')
    .eq('session_id', sessionId)
    .eq('action_type', 'save_context')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ notes: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { nodeId, nodeType, nodeTitle, note } = body

  if (!nodeId || !nodeType || typeof note !== 'string') {
    return Response.json({ error: 'nodeId, nodeType, note required' }, { status: 400 })
  }

  const db = createServerClient()
  const id = randomUUID()
  const { error } = await db.from('human_actions').insert({
    id,
    session_id: sessionId,
    action_type: 'save_context',
    target_id: nodeId,
    target_type: nodeType,
    note: note.trim(),
    user_id: user.id,
    metadata: { node_title: nodeTitle, node_type: nodeType, note: note.trim() },
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, id })
}
