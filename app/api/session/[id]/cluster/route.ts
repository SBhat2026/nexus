import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * PATCH /api/session/[id]/cluster
 * Body: { clusterId: string, customLabel?: string | null, color?: string | null }
 *
 * Sets (or clears, when blank/null) user overrides on a cluster. Only the fields
 * present in the body are touched. `custom_label`/`custom_color` take precedence
 * over the AI label / default color everywhere the cluster is rendered.
 */
const HEX = /^#[0-9a-fA-F]{6}$/

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params
    const body = await req.json()
    const clusterId: string = body.clusterId ?? ''

    if (!sessionId || !clusterId) {
      return Response.json({ error: 'sessionId and clusterId required' }, { status: 400 })
    }

    const update: { custom_label?: string | null; custom_color?: string | null } = {}
    if ('customLabel' in body) {
      const raw: unknown = body.customLabel
      update.custom_label = typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 60) : null
    }
    if ('color' in body) {
      const raw: unknown = body.color
      update.custom_color = typeof raw === 'string' && HEX.test(raw.trim()) ? raw.trim() : null
    }
    if (Object.keys(update).length === 0) {
      return Response.json({ error: 'nothing to update' }, { status: 400 })
    }

    const db = createServerClient()
    const { error } = await db
      .from('clusters')
      .update(update)
      .eq('id', clusterId)
      .eq('session_id', sessionId)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, clusterId, ...update })
  } catch (err) {
    console.error('[session/cluster PATCH]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
