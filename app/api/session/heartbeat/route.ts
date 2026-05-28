import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sessionId: string = body.sessionId
    if (!sessionId || typeof sessionId !== 'string') {
      return Response.json({ ok: false }, { status: 400 })
    }
    const db = createServerClient()
    await db.from('sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', sessionId)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false }, { status: 200 })
  }
}
