import type { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { fetchRefs } from '@/lib/sources/index'
import { getPapersWithEmbeddings } from '@/lib/papers/cache'
import { createServerClient } from '@/lib/supabase/server'
import { runClusteringPipeline } from '@/lib/clustering/pipeline'
import { cosineDistance } from '@/lib/clustering/dbscan'
import { projectEmbeddings } from '@/lib/umap/project'
import { labelClustersGroq } from '@/lib/groq/labelClusters'
import type { ClusterNode, PaperNode, GraphEdge } from '@/lib/types'

export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const { nodeId } = await params
    const body = await req.json()
    const sessionId: string = body.sessionId ?? ''
    const externalId: string = body.s2PaperId ?? ''
    const generation: number = typeof body.generation === 'number' ? body.generation : 2

    if (!sessionId || !externalId) {
      return Response.json({ error: 'sessionId and s2PaperId required' }, { status: 400 })
    }

    const db = createServerClient()

    // Fetch the title of the source paper for CORE fallback topic search
    const { data: sourcePaper } = await db.from('papers').select('title').eq('s2_paper_id', externalId).eq('session_id', sessionId).single()
    const seedTitle = sourcePaper?.title ?? externalId

    // Fetch related works — 70% from last 3 years, 30% unconstrained
    const { works: relatedWorks } = await fetchRefs(externalId, seedTitle, 60, { recentRatio: 0.7, recentYears: 3 })
    const relatedIds = relatedWorks.map((w) => w.id)

    const { data: existing } = await db.from('papers').select('s2_paper_id').eq('session_id', sessionId)
    const existingIds = new Set((existing ?? []).map((r: { s2_paper_id: string }) => r.s2_paper_id))
    const newIds = relatedIds.filter((id) => !existingIds.has(id))

    if (newIds.length === 0) return Response.json({ newNodes: [], newEdges: [] })

    const cached = await getPapersWithEmbeddings(newIds)
    const withEmbeddings = cached.filter((p) => p.embedding?.length === 1024)

    if (withEmbeddings.length < 3) return Response.json({ newNodes: [], newEdges: [] })

    // Run full clustering pipeline on new papers
    const vectors = withEmbeddings.map((p) => p.embedding as number[])
    const pipeline = runClusteringPipeline(vectors)
    const umapCoords = projectEmbeddings(vectors)

    function computeMedianYear(years: number[]): number | null {
      const valid = years.filter((y) => y > 0).sort((a, b) => a - b)
      if (!valid.length) return null
      const mid = Math.floor(valid.length / 2)
      return valid.length % 2 ? valid[mid] : Math.round((valid[mid - 1] + valid[mid]) / 2)
    }
    const clusterMedianYears = new Map<number, number | null>()
    pipeline.clusters.forEach((c, i) => {
      clusterMedianYears.set(i, computeMedianYear(c.memberIndices.map((idx) => withEmbeddings[idx].year ?? 0)))
    })

    // Compute representative papers: 1 centroid-closest + 2 highest citation per cluster
    const representativeIds = new Set<string>()
    pipeline.clusters.forEach((c) => {
      if (c.memberIndices.length === 0) return
      let minDist = Infinity, centroidIdx = -1
      c.memberIndices.forEach((pi) => {
        const d = cosineDistance(vectors[pi], c.center)
        if (d < minDist) { minDist = d; centroidIdx = pi }
      })
      const centroidExtId = centroidIdx >= 0 ? withEmbeddings[centroidIdx].external_id : null
      if (centroidExtId) representativeIds.add(centroidExtId)
      c.memberIndices
        .filter((pi) => withEmbeddings[pi].external_id !== centroidExtId)
        .sort((a, b) => (withEmbeddings[b].citation_count ?? 0) - (withEmbeddings[a].citation_count ?? 0))
        .slice(0, 2)
        .forEach((pi) => representativeIds.add(withEmbeddings[pi].external_id))
    })

    const newNodes: (ClusterNode | PaperNode)[] = []
    const newEdges: GraphEdge[] = []

    const clusterPrefix = `${sessionId}-cluster-g${generation}`

    // Compute UMAP centroids per cluster
    const clusterUmapCentroids = new Map<number, [number, number]>()
    pipeline.clusters.forEach((c, i) => {
      const xs = c.memberIndices.map((idx) => umapCoords[idx][0])
      const ys = c.memberIndices.map((idx) => umapCoords[idx][1])
      clusterUmapCentroids.set(i, [
        xs.reduce((a, b) => a + b, 0) / xs.length,
        ys.reduce((a, b) => a + b, 0) / ys.length,
      ])
    })

    // Insert cluster rows
    const clusterDbRows = pipeline.clusters.map((c, i) => ({
      id: `${clusterPrefix}-${i}`,
      session_id: sessionId,
      label: `Cluster ${String.fromCharCode(65 + i)} (${c.memberIndices.length})`,
      description: null as string | null,
      center_embedding: c.center,
      paper_count: c.memberIndices.length,
      field: null as string | null,
      is_pruned: false,
      median_year: clusterMedianYears.get(i) ?? null,
    }))
    if (clusterDbRows.length > 0) {
      await db.from('clusters').insert(clusterDbRows)
    }

    // Label new clusters
    const clusterInputs = pipeline.clusters.map((c, i) => ({
      clusterIndex: i,
      papers: c.memberIndices.slice(0, 5).map((pi) => ({
        title: withEmbeddings[pi].title,
        abstractPrefix: (withEmbeddings[pi].abstract ?? '').slice(0, 400),
      })),
    }))
    let labelResult = { labels: [] as Awaited<ReturnType<typeof labelClustersGroq>>['labels'] }
    try {
      const r = await labelClustersGroq(clusterInputs)
      labelResult = r
    } catch (err) {
      console.warn('[expand/nodeId] Groq labeling failed, using generic labels:', err)
    }
    const labelMap = new Map(labelResult.labels.map((l) => [l.clusterIndex, l]))

    if (labelResult.labels.length > 0) {
      await Promise.all(labelResult.labels.map((l) =>
        db.from('clusters')
          .update({ label: l.label, description: l.description, field: l.field })
          .eq('id', `${clusterPrefix}-${l.clusterIndex}`)
          .eq('session_id', sessionId)
      ))
    }

    // Build ClusterNode objects
    const newClusterIds = new Set<string>()
    pipeline.clusters.forEach((c, i) => {
      const lbl = labelMap.get(i)
      const umapCentroid = clusterUmapCentroids.get(i)
      const clusterId = `${clusterPrefix}-${i}`
      newClusterIds.add(clusterId)
      const clusterNode: ClusterNode = {
        id: clusterId,
        nodeType: 'cluster',
        label: lbl?.label ?? `Cluster ${String.fromCharCode(65 + i)} (${c.memberIndices.length})`,
        description: lbl?.description ?? '',
        paperCount: c.memberIndices.length,
        field: lbl?.field ?? 'default',
        isPruned: false,
        generation,
        medianYear: clusterMedianYears.get(i) ?? null,
        umapX: umapCentroid?.[0],
        umapY: umapCentroid?.[1],
      }
      newNodes.push(clusterNode)
      // Edge: source paper → new cluster (shows expansion origin)
      newEdges.push({
        id: `e-expand-${nodeId}-${clusterId}`,
        source: nodeId,
        target: clusterId,
        edgeType: 'citation',
        weight: 1,
      })
    })

    const idToWork = new Map(relatedWorks.map((w) => [w.id, w]))

    // Insert paper rows and build PaperNode objects
    const paperRows = withEmbeddings.map((p, i) => {
      const clusterIdx = pipeline.assignments[i]
      const clusterId = clusterIdx >= 0 ? `${clusterPrefix}-${clusterIdx}` : null
      const [umapX, umapY] = umapCoords[i] ?? [null, null]
      const work = idToWork.get(p.external_id)
      return {
        id: randomUUID(),
        session_id: sessionId,
        s2_paper_id: p.external_id,
        title: p.title,
        abstract: p.abstract ?? null,
        authors: p.authors ?? [],
        year: p.year ?? null,
        citation_count: p.citation_count,
        embedding: p.embedding,
        cluster_id: clusterId,
        is_outlier: pipeline.outlierFlags[i],
        is_representative: representativeIds.has(p.external_id),
        nearest_cluster_id: pipeline.nearestClusterIndex[i] >= 0
          ? `${clusterPrefix}-${pipeline.nearestClusterIndex[i]}`
          : null,
        tldr: null,
        s2_url: p.external_id.startsWith('core:')
          ? `https://core.ac.uk/works/${p.external_id.replace('core:', '')}`
          : `https://openalex.org/${p.external_id}`,
        venue: work?.venue ?? null,
        umap_x: umapX as number | null,
        umap_y: umapY as number | null,
      }
    })
    if (paperRows.length > 0) await db.from('papers').insert(paperRows)

    paperRows.forEach((r) => {
      newNodes.push({
        id: r.id,
        nodeType: 'paper',
        s2PaperId: r.s2_paper_id,
        title: r.title,
        abstract: r.abstract ?? '',
        authors: r.authors,
        year: r.year ?? 0,
        citationCount: r.citation_count,
        clusterId: r.cluster_id,
        isOutlier: r.is_outlier,
        s2Url: r.s2_url,
        venue: r.venue ?? null,
        umapX: r.umap_x ?? undefined,
        umapY: r.umap_y ?? undefined,
      } as PaperNode)
    })

    // Save edges
    const edgeRows = newEdges.map((e) => ({
      session_id: sessionId,
      source_id: e.source,
      source_type: 'paper',
      target_id: e.target,
      target_type: newClusterIds.has(e.target) ? 'cluster' : 'paper',
      weight: e.weight,
      edge_type: e.edgeType,
    }))
    if (edgeRows.length > 0) await db.from('edges').insert(edgeRows)

    return Response.json({ newNodes, newEdges })
  } catch (err) {
    console.error('[expand/nodeId]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
