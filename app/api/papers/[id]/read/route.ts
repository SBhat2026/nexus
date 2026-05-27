import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: paperId } = await params
    const body = await req.json()
    const sessionId: string = body.sessionId ?? ''
    const isRead: boolean = body.isRead ?? true

    if (!sessionId || !paperId) {
      return Response.json({ error: 'sessionId and paperId required' }, { status: 400 })
    }

    const db = createServerClient()

    if (isRead) {
      await db.from('human_actions').upsert(
        {
          session_id: sessionId,
          action_type: 'read',
          target_id: paperId,
          target_type: 'paper',
        },
        { onConflict: 'session_id,action_type,target_id' },
      )
    } else {
      await db
        .from('human_actions')
        .delete()
        .eq('session_id', sessionId)
        .eq('action_type', 'read')
        .eq('target_id', paperId)
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[papers/read]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
