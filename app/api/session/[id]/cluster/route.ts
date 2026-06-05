import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * PATCH /api/session/[id]/cluster
 * Body: { clusterId: string, customLabel: string | null }
 *
 * Sets (or clears, when blank/null) a user-supplied cluster name. `custom_label`
 * takes precedence over the AI `label` everywhere the cluster is rendered.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params
    const body = await req.json()
    const clusterId: string = body.clusterId ?? ''
    const raw: unknown = body.customLabel
    const customLabel = typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 60) : null

    if (!sessionId || !clusterId) {
      return Response.json({ error: 'sessionId and clusterId required' }, { status: 400 })
    }

    const db = createServerClient()
    const { error } = await db
      .from('clusters')
      .update({ custom_label: customLabel })
      .eq('id', clusterId)
      .eq('session_id', sessionId)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, clusterId, customLabel })
  } catch (err) {
    console.error('[session/cluster PATCH]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
