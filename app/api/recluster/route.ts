import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { runClusteringPipeline } from '@/lib/clustering/pipeline'
import { projectEmbeddings } from '@/lib/umap/project'
import { cosineDistance } from '@/lib/clustering/dbscan'
import { labelClusters } from '@/lib/anthropic/labelClusters'
import { labelClustersGroq } from '@/lib/groq/labelClusters'
import type { ClusterNode, PaperNode, OutlierNode, GraphData, GraphEdge } from '@/lib/types'

export const maxDuration = 60

type PaperRow = {
  id: string
  s2_paper_id: string
  title: string
  abstract: string | null
  authors: string[]
  year: number | null
  citation_count: number
  s2_url: string | null
  tldr: string | null
}

function computeMedianYear(years: number[]): number | null {
  const valid = years.filter((y) => y > 0).sort((a, b) => a - b)
  if (!valid.length) return null
  const mid = Math.floor(valid.length / 2)
  return valid.length % 2 ? valid[mid] : Math.round((valid[mid - 1] + valid[mid]) / 2)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sessionId: string = body.sessionId ?? ''
    const dateRange: { min: number; max: number } | null = body.dateRange ?? null

    if (!sessionId) {
      return Response.json({ error: 'sessionId required' }, { status: 400 })
    }

    const db = createServerClient()

    // Load papers within date range (or all papers if no range)
    let query = db.from('papers').select('id,s2_paper_id,title,abstract,authors,year,citation_count,s2_url,tldr').eq('session_id', sessionId)
    if (dateRange) {
      query = (query as ReturnType<typeof query.gte>).gte('year', dateRange.min).lte('year', dateRange.max)
    }
    const { data: papers, error: papersError } = await query
    if (papersError) {
      return Response.json({ error: 'Failed to load papers' }, { status: 500 })
    }
    if (!papers || papers.length < 3) {
      return Response.json({ error: 'Too few papers in this range — broaden the dates.' }, { status: 200 })
    }

    // Fetch embeddings from cache
    const s2Ids = (papers as PaperRow[]).map((p) => p.s2_paper_id)
    const { data: cached } = await db
      .from('embedding_cache')
      .select('s2_paper_id,embedding')
      .in('s2_paper_id', s2Ids)

    const embMap = new Map<string, number[]>(
      (cached ?? [])
        .filter((r: { s2_paper_id: string; embedding: number[] | null }) => r.embedding?.length === 1024)
        .map((r: { s2_paper_id: string; embedding: number[] }) => [r.s2_paper_id, r.embedding])
    )

    const withEmb = (papers as PaperRow[]).filter((p) => embMap.has(p.s2_paper_id))
    if (withEmb.length < 3) {
      return Response.json({ error: 'Too few papers with embeddings in this range.' }, { status: 200 })
    }

    const vectors = withEmb.map((p) => embMap.get(p.s2_paper_id) as number[])
    const pipeline = runClusteringPipeline(vectors)
    const umapCoords = projectEmbeddings(vectors)

    // Median year per cluster
    const clusterMedianYears = new Map<number, number | null>()
    pipeline.clusters.forEach((c, i) => {
      clusterMedianYears.set(i, computeMedianYear(c.memberIndices.map((idx) => withEmb[idx].year ?? 0)))
    })

    // Representative papers
    const representativeIds = new Set<string>()
    pipeline.clusters.forEach((c) => {
      if (!c.memberIndices.length) return
      let minDist = Infinity, centIdx = -1
      c.memberIndices.forEach((pi) => {
        const d = cosineDistance(vectors[pi], c.center)
        if (d < minDist) { minDist = d; centIdx = pi }
      })
      if (centIdx >= 0) representativeIds.add(withEmb[centIdx].id)
      c.memberIndices
        .filter((pi) => withEmb[pi].id !== (centIdx >= 0 ? withEmb[centIdx].id : ''))
        .sort((a, b) => withEmb[b].citation_count - withEmb[a].citation_count)
        .slice(0, 2)
        .forEach((pi) => representativeIds.add(withEmb[pi].id))
    })

    // UMAP centroids
    const clusterUmapCentroids = new Map<number, [number, number]>()
    pipeline.clusters.forEach((c, i) => {
      const xs = c.memberIndices.map((idx) => umapCoords[idx][0])
      const ys = c.memberIndices.map((idx) => umapCoords[idx][1])
      clusterUmapCentroids.set(i, [
        xs.reduce((a, b) => a + b, 0) / xs.length,
        ys.reduce((a, b) => a + b, 0) / ys.length,
      ])
    })

    // Replace clusters in DB
    await db.from('clusters').delete().eq('session_id', sessionId)

    const clusterRows = pipeline.clusters.map((c, i) => {
      const coord = clusterUmapCentroids.get(i)
      return {
        id: `${sessionId}-cluster-${i}`,
        session_id: sessionId,
        label: `Cluster ${String.fromCharCode(65 + i)} (${c.memberIndices.length})`,
        description: null as string | null,
        center_embedding: c.center,
        paper_count: c.memberIndices.length,
        field: null as string | null,
        is_pruned: false,
        umap_x: coord?.[0] ?? null,
        umap_y: coord?.[1] ?? null,
        cluster_quality: pipeline.clusterQuality[i] ?? null,
        median_year: clusterMedianYears.get(i) ?? null,
      }
    })
    if (clusterRows.length > 0) await db.from('clusters').insert(clusterRows)

    // AI labeling
    const clusterInputs = pipeline.clusters.map((c, i) => ({
      clusterIndex: i,
      papers: c.memberIndices
        .filter((pi) => representativeIds.has(withEmb[pi].id))
        .slice(0, 5)
        .map((pi) => ({
          title: withEmb[pi].title,
          abstractPrefix: (withEmb[pi].abstract ?? '').slice(0, 400),
        })),
    }))
    let labelResult = await labelClusters(clusterInputs)
    if (labelResult.labels.length === 0 && clusterInputs.length > 0) {
      labelResult = await labelClustersGroq(clusterInputs)
    }
    const labelMap = new Map(labelResult.labels.map((l) => [l.clusterIndex, l]))

    if (labelResult.labels.length > 0) {
      await Promise.all(labelResult.labels.map((l) =>
        db.from('clusters')
          .update({ label: l.label, description: l.description, field: l.field })
          .eq('id', `${sessionId}-cluster-${l.clusterIndex}`)
          .eq('session_id', sessionId)
      ))
    }

    // Update paper cluster assignments
    await Promise.all(withEmb.map((p, i) => {
      const clusterIdx = pipeline.assignments[i]
      const newClusterId = clusterIdx >= 0 ? `${sessionId}-cluster-${clusterIdx}` : null
      return db.from('papers')
        .update({ cluster_id: newClusterId, is_outlier: pipeline.outlierFlags[i] })
        .eq('id', p.id)
    }))

    // Build GraphData
    const nodes: (ClusterNode | PaperNode | OutlierNode)[] = []

    pipeline.clusters.forEach((c, i) => {
      const lbl = labelMap.get(i)
      const coord = clusterUmapCentroids.get(i)
      nodes.push({
        id: `${sessionId}-cluster-${i}`,
        nodeType: 'cluster',
        label: lbl?.label ?? `Cluster ${String.fromCharCode(65 + i)} (${c.memberIndices.length})`,
        description: lbl?.description ?? '',
        paperCount: c.memberIndices.length,
        field: lbl?.field ?? 'default',
        isPruned: false,
        clusterQuality: pipeline.clusterQuality[i] ?? undefined,
        medianYear: clusterMedianYears.get(i) ?? null,
        umapX: coord?.[0],
        umapY: coord?.[1],
      } as ClusterNode)
    })

    withEmb.forEach((p, i) => {
      const clusterIdx = pipeline.assignments[i]
      const clusterId = clusterIdx >= 0 ? `${sessionId}-cluster-${clusterIdx}` : null
      const [umapX, umapY] = umapCoords[i] ?? [null, null]
      if (pipeline.outlierFlags[i]) {
        nodes.push({
          id: p.id,
          nodeType: 'outlier',
          s2PaperId: p.s2_paper_id,
          title: p.title,
          abstract: p.abstract ?? '',
          authors: p.authors,
          year: p.year ?? 0,
          citationCount: p.citation_count,
          mahalanobisDistance: 0,
          nearestClusterId: clusterId ?? '',
          overlapClusterIds: clusterId ? [clusterId] : [],
          isFlagged: false,
          umapX: umapX as number | undefined,
          umapY: umapY as number | undefined,
        } as OutlierNode)
      } else {
        nodes.push({
          id: p.id,
          nodeType: 'paper',
          s2PaperId: p.s2_paper_id,
          title: p.title,
          abstract: p.abstract ?? '',
          authors: p.authors,
          year: p.year ?? 0,
          citationCount: p.citation_count,
          clusterId,
          isOutlier: false,
          isRepresentative: representativeIds.has(p.id),
          tldr: p.tldr ?? undefined,
          s2Url: p.s2_url ?? undefined,
          umapX: umapX as number | undefined,
          umapY: umapY as number | undefined,
        } as PaperNode)
      }
    })

    const edges: GraphEdge[] = []
    withEmb.forEach((p, i) => {
      const clusterIdx = pipeline.assignments[i]
      if (clusterIdx >= 0) {
        edges.push({
          id: `e-${p.id}-${sessionId}-cluster-${clusterIdx}`,
          source: p.id,
          target: `${sessionId}-cluster-${clusterIdx}`,
          edgeType: 'semantic_similarity',
          weight: 1,
        })
      }
    })

    const graph: GraphData = { nodes, edges }
    return Response.json({ graph })
  } catch (err) {
    console.error('[recluster]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
