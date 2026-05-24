import type { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { getReferences, getCitations } from '@/lib/s2/client'
import { getPapersWithEmbeddings } from '@/lib/s2/cache'
import { createServerClient } from '@/lib/supabase/server'
import type { GraphData, PaperNode, GraphEdge } from '@/lib/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const { nodeId } = await params
    const body = await req.json()
    const sessionId: string = body.sessionId ?? ''
    const s2PaperId: string = body.s2PaperId ?? ''

    if (!sessionId || !s2PaperId) {
      return Response.json({ error: 'sessionId and s2PaperId required' }, { status: 400 })
    }

    // Fetch references and citations in parallel
    const [refs, cites] = await Promise.all([
      getReferences(s2PaperId, 15),
      getCitations(s2PaperId, 10),
    ])

    const allPapers = [...refs, ...cites]
    const uniqueIds = [...new Set(allPapers.map((p) => p.paperId).filter(Boolean))]

    const cached = await getPapersWithEmbeddings(uniqueIds)
    const withEmbeddings = cached.filter((p) => p.embedding?.length === 768)

    const db = createServerClient()

    // Check which papers are already in this session
    const { data: existing } = await db
      .from('papers')
      .select('s2_paper_id')
      .eq('session_id', sessionId)

    const existingIds = new Set((existing ?? []).map((r: { s2_paper_id: string }) => r.s2_paper_id))
    const newPapers = withEmbeddings.filter((p) => !existingIds.has(p.s2_paper_id))

    const newNodes: GraphData['nodes'] = []
    const newEdges: GraphEdge[] = []

    if (newPapers.length > 0) {
      const rows = newPapers.map((p) => ({
        id: randomUUID(),
        session_id: sessionId,
        s2_paper_id: p.s2_paper_id,
        title: p.title,
        abstract: p.abstract ?? null,
        authors: p.authors ?? [],
        year: p.year ?? null,
        citation_count: p.citation_count,
        embedding: p.embedding,
        cluster_id: null,
        is_outlier: false,
        tldr: p.tldr ?? null,
        s2_url: `https://www.semanticscholar.org/paper/${p.s2_paper_id}`,
      }))

      await db.from('papers').insert(rows)

      rows.forEach((r) => {
        const node: PaperNode = {
          id: r.id,
          nodeType: 'paper',
          s2PaperId: r.s2_paper_id,
          title: r.title,
          abstract: r.abstract ?? '',
          authors: r.authors,
          year: r.year ?? 0,
          citationCount: r.citation_count,
          clusterId: null,
          isOutlier: false,
          tldr: r.tldr ?? undefined,
          s2Url: r.s2_url,
        }
        newNodes.push(node)

        const edge: GraphEdge = {
          id: `e-expand-${nodeId}-${r.id}`,
          source: nodeId,
          target: r.id,
          edgeType: 'citation',
          weight: 1,
        }
        newEdges.push(edge)
      })

      const edgeRows = newEdges.map((e) => ({
        session_id: sessionId,
        source_id: e.source,
        source_type: 'paper',
        target_id: e.target,
        target_type: 'paper',
        weight: e.weight,
        edge_type: e.edgeType,
      }))
      if (edgeRows.length > 0) await db.from('edges').insert(edgeRows)
    }

    return Response.json({ newNodes, newEdges })
  } catch (err) {
    console.error('[expand/nodeId]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
