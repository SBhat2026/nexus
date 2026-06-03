import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

interface Ancestor {
  sessionId: string
  seedTopic: string
  depth: number
  clusterLabel: string | null
}

const MAX_HOPS = 10

/**
 * GET — the full ancestor chain for a session, ordered root → current.
 * Walks parent_session_id iteratively (capped) to avoid needing a Postgres
 * recursive RPC. Each non-root entry carries the parent cluster's label.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params
    const db = createServerClient()

    interface SessionRow {
      id: string
      seed_topic: string
      depth: number | null
      parent_session_id: string | null
      parent_cluster_id: string | null
    }

    const chain: Ancestor[] = []
    let currentId: string | null = sessionId

    for (let i = 0; i < MAX_HOPS && currentId; i++) {
      const res = await db
        .from('sessions')
        .select('id, seed_topic, depth, parent_session_id, parent_cluster_id')
        .eq('id', currentId)
        .single()

      const row = res.data as SessionRow | null
      if (res.error || !row) break

      let clusterLabel: string | null = null
      if (row.parent_cluster_id) {
        const { data: c } = await db
          .from('clusters')
          .select('label')
          .eq('id', row.parent_cluster_id)
          .maybeSingle()
        clusterLabel = (c as { label?: string } | null)?.label ?? null
      }

      chain.push({
        sessionId: row.id,
        seedTopic: row.seed_topic,
        depth: row.depth ?? 0,
        clusterLabel,
      })

      currentId = row.parent_session_id ?? null
    }

    chain.reverse() // root → current
    return Response.json({ ancestors: chain })
  } catch (err) {
    console.error('[session/ancestors]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
