import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { GraphData } from '@/lib/types'

const RETENTION = 100 // keep the most recent N snapshots per session

/**
 * GET  /api/session/[id]/snapshots        → list snapshot metadata (no graph blob)
 * POST /api/session/[id]/snapshots        → create a checkpoint from the supplied graph
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params
    const db = createServerClient()
    const { data, error } = await db
      .from('session_snapshots')
      .select('id, version, parent_version, label, origin, node_count, edge_count, created_at')
      .eq('session_id', sessionId)
      .order('version', { ascending: false })

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ snapshots: data ?? [] })
  } catch (err) {
    console.error('[snapshots/GET]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params
    const body = await req.json()
    const graph = body.graph as GraphData | undefined
    const label: string | null = typeof body.label === 'string' ? body.label.slice(0, 200) : null
    const origin: string = ['manual', 'auto', 'revert', 'initial'].includes(body.origin) ? body.origin : 'manual'
    const parentVersion: number | null = typeof body.parentVersion === 'number' ? body.parentVersion : null

    if (!sessionId || !graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return Response.json({ error: 'sessionId and a valid graph are required' }, { status: 400 })
    }

    const db = createServerClient()

    // Next version = current max + 1 (monotonic per session, even across branches).
    const { data: maxRow } = await db
      .from('session_snapshots')
      .select('version')
      .eq('session_id', sessionId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    const version = (maxRow?.version ?? 0) + 1

    const { data: inserted, error } = await db
      .from('session_snapshots')
      .insert({
        session_id: sessionId,
        version,
        parent_version: parentVersion,
        label,
        origin,
        graph,
        node_count: graph.nodes.length,
        edge_count: graph.edges.length,
      })
      .select('id, version, parent_version, label, origin, node_count, edge_count, created_at')
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Retention: prune anything older than the most recent RETENTION versions.
    if (version > RETENTION) {
      await db
        .from('session_snapshots')
        .delete()
        .eq('session_id', sessionId)
        .lte('version', version - RETENTION)
    }

    return Response.json({ ok: true, snapshot: inserted })
  } catch (err) {
    console.error('[snapshots/POST]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
