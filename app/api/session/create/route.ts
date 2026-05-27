import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { searchWorks, oaId } from '@/lib/openalex/client'
import { reconstructAbstract } from '@/lib/openalex/types'
import { getPapersWithEmbeddings } from '@/lib/papers/cache'
import { runClusteringPipeline } from '@/lib/clustering/pipeline'
import { cosineDistance } from '@/lib/clustering/dbscan'
import { buildGraph } from '@/lib/graphBuilder'
import { projectEmbeddings } from '@/lib/umap/project'
import { createServerClient } from '@/lib/supabase/server'
import { labelClusters } from '@/lib/anthropic/labelClusters'
import { labelClustersGroq } from '@/lib/groq/labelClusters'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const seedTopic: string = (body.seedTopic ?? '').trim()

    if (!seedTopic || seedTopic.length < 2 || seedTopic.length > 1000) {
      return Response.json({ error: 'seedTopic must be 2-1000 characters' }, { status: 400 })
    }

    // 1. Fetch 85 papers from OpenAlex — 70% from last 3 years, 30% unconstrained
    const works = await searchWorks(seedTopic, 85, { recentRatio: 0.7, recentYears: 3 })
    if (works.length === 0) {
      return Response.json({ error: 'No papers found for this topic', sessionId: null, graph: null }, { status: 200 })
    }

    const bareIds = works.map((w) => oaId(w.id))

    const db = createServerClient()
    const existingIds = await db
      .from('embedding_cache')
      .select('s2_paper_id')
      .in('s2_paper_id', bareIds)
      .then((r) => new Set((r.data ?? []).map((x: { s2_paper_id: string }) => x.s2_paper_id)))

    const newWorks = works.filter((w) => !existingIds.has(oaId(w.id)))
    if (newWorks.length > 0) {
      const stubs = newWorks.map((w) => ({
        s2_paper_id: oaId(w.id),
        title: w.title || '',
        abstract: reconstructAbstract(w.abstract_inverted_index) || null,
        authors: w.authorships?.map((a) => a.author.display_name) ?? [],
        year: w.publication_year,
        citation_count: w.cited_by_count,
        embedding: null,
        tldr: null,
      }))
      await db.from('embedding_cache').upsert(stubs, { onConflict: 's2_paper_id' })
    }

    // 2. Embeddings
    const papers = await getPapersWithEmbeddings(bareIds)
    const withEmbeddings = papers.filter((p) => p.embedding && p.embedding.length === 1024)

    if (withEmbeddings.length < 3) {
      return Response.json({ error: 'Insufficient papers with embeddings for clustering' }, { status: 200 })
    }

    // 3. Cluster (PCA → UMAP 15D → DBSCAN) + UMAP 2D for visualization
    const vectors = withEmbeddings.map((p) => p.embedding as number[])
    const pipeline = runClusteringPipeline(vectors)
    const umapCoords = projectEmbeddings(vectors)

    // 4. Map papers
    const oaIdToPaper = new Map(works.map((w) => [oaId(w.id), w]))
    const papersMapped = withEmbeddings.map((p) => {
      const work = oaIdToPaper.get(p.external_id)
      return {
        id: randomUUID(),
        s2PaperId: p.external_id,
        title: p.title,
        abstract: p.abstract ?? '',
        authors: p.authors ?? [],
        year: p.year ?? 0,
        citationCount: p.citation_count,
        referenceIds: work?.referenced_works?.map(oaId) ?? [],
        s2Url: `https://openalex.org/${p.external_id}`,
      }
    })

    // 5. Compute representative papers per cluster:
    //    - 1 paper closest to cluster centroid (cosine distance in embedding space)
    //    - 2 highest citation-count papers (excluding centroid paper)
    const representativeIds = new Set<string>()
    pipeline.clusters.forEach((c) => {
      if (c.memberIndices.length === 0) return

      // Centroid-closest paper
      let minDist = Infinity, centroidPaperLocalIdx = -1
      c.memberIndices.forEach((pi) => {
        const d = cosineDistance(vectors[pi], c.center)
        if (d < minDist) { minDist = d; centroidPaperLocalIdx = pi }
      })
      const centroidPaperId = centroidPaperLocalIdx >= 0 ? papersMapped[centroidPaperLocalIdx].id : null
      if (centroidPaperId) representativeIds.add(centroidPaperId)

      // Top 2 by citation count (excluding centroid paper)
      c.memberIndices
        .filter((pi) => papersMapped[pi].id !== centroidPaperId)
        .sort((a, b) => papersMapped[b].citationCount - papersMapped[a].citationCount)
        .slice(0, 2)
        .forEach((pi) => representativeIds.add(papersMapped[pi].id))
    })

    const graph = buildGraph(papersMapped, pipeline, umapCoords, representativeIds)

    // Compute median publication year per cluster for staleness indicator
    function computeMedianYear(years: number[]): number | null {
      const valid = years.filter((y) => y > 0).sort((a, b) => a - b)
      if (!valid.length) return null
      const mid = Math.floor(valid.length / 2)
      return valid.length % 2 ? valid[mid] : Math.round((valid[mid - 1] + valid[mid]) / 2)
    }
    const clusterMedianYears = new Map<number, number | null>()
    pipeline.clusters.forEach((c) => {
      clusterMedianYears.set(c.clusterIndex, computeMedianYear(c.memberIndices.map((i) => papersMapped[i].year)))
    })

    // 6. Persist to Supabase
    const sessionId = randomUUID()
    await db.from('sessions').insert({ id: sessionId, seed_topic: seedTopic })

    const clusterUmapCentroids = new Map<number, [number, number]>()
    pipeline.clusters.forEach((c) => {
      if (umapCoords.length > 0) {
        const xs = c.memberIndices.map((i) => umapCoords[i][0])
        const ys = c.memberIndices.map((i) => umapCoords[i][1])
        clusterUmapCentroids.set(c.clusterIndex, [
          xs.reduce((a, b) => a + b, 0) / xs.length,
          ys.reduce((a, b) => a + b, 0) / ys.length,
        ])
      }
    })

    const clusterRows = pipeline.clusters.map((c) => {
      const centroid = clusterUmapCentroids.get(c.clusterIndex)
      return {
        id: `${sessionId}-cluster-${c.clusterIndex}`,
        session_id: sessionId,
        label: `Cluster ${String.fromCharCode(65 + c.clusterIndex)} (${c.memberIndices.length})`,
        description: null,
        center_embedding: c.center,
        paper_count: c.memberIndices.length,
        field: null,
        is_pruned: false,
        umap_x: centroid?.[0] ?? null,
        umap_y: centroid?.[1] ?? null,
        cluster_quality: pipeline.clusterQuality[c.clusterIndex] ?? null,
        median_year: clusterMedianYears.get(c.clusterIndex) ?? null,
      }
    })
    if (clusterRows.length > 0) {
      const { error: clusterInsertErr } = await db.from('clusters').insert(clusterRows)
      if (clusterInsertErr) {
        console.warn('[session/create] cluster insert failed, retrying with minimal columns:', clusterInsertErr.message)
        const minimalRows = clusterRows.map((r) => ({
          id: r.id,
          session_id: r.session_id,
          label: r.label,
          description: r.description,
          center_embedding: r.center_embedding,
          paper_count: r.paper_count,
          field: r.field,
          is_pruned: r.is_pruned,
        }))
        const { error: retryErr } = await db.from('clusters').insert(minimalRows)
        if (retryErr) {
          console.error('[session/create] cluster insert retry failed:', retryErr.message)
        }
      }
    }

    // AI cluster labeling — fire after insert, update rows if successful
    const clusterInputs = pipeline.clusters.map((c) => ({
      clusterIndex: c.clusterIndex,
      papers: c.memberIndices
        .filter((i) => representativeIds.has(papersMapped[i].id))
        .slice(0, 5)
        .map((i) => ({
          title: papersMapped[i].title,
          abstractPrefix: papersMapped[i].abstract.slice(0, 400),
        })),
    }))
    let labelResult = await labelClusters(clusterInputs)
    if (labelResult.labels.length === 0 && clusterInputs.length > 0) {
      labelResult = await labelClustersGroq(clusterInputs)
    }
    const labels = labelResult.labels
    if (labels.length > 0) {
      await Promise.all(labels.map((l) =>
        db.from('clusters')
          .update({ label: l.label, description: l.description, field: l.field })
          .eq('id', `${sessionId}-cluster-${l.clusterIndex}`)
          .eq('session_id', sessionId)
      ))
    }


    const paperRows = papersMapped.map((p, i) => ({
      id: p.id,
      session_id: sessionId,
      s2_paper_id: p.s2PaperId,
      title: p.title,
      abstract: p.abstract,
      authors: p.authors,
      year: p.year,
      citation_count: p.citationCount,
      embedding: withEmbeddings[i].embedding,
      cluster_id: pipeline.assignments[i] >= 0
        ? `${sessionId}-cluster-${pipeline.assignments[i]}`
        : null,
      is_outlier: pipeline.outlierFlags[i],
      is_representative: representativeIds.has(p.id),
      tldr: null,
      s2_url: p.s2Url,
      umap_x: umapCoords[i]?.[0] ?? null,
      umap_y: umapCoords[i]?.[1] ?? null,
    }))
    if (paperRows.length > 0) await db.from('papers').insert(paperRows)

    const edgeRows = graph.edges.slice(0, 500).map((e) => ({
      session_id: sessionId,
      source_id: e.source,
      source_type: 'node',
      target_id: e.target,
      target_type: 'node',
      weight: e.weight,
      edge_type: e.edgeType,
    }))
    if (edgeRows.length > 0) await db.from('edges').insert(edgeRows)

    // Build label map for in-response enrichment
    const labelMap = new Map(labels.map((l) => [l.clusterIndex, l]))

    // Fix cluster IDs to session-scoped form + apply AI labels
    const fixedGraph = {
      nodes: graph.nodes.map((n) => {
        if (n.nodeType === 'cluster') {
          const idx = parseInt((n.id as string).replace('cluster-', ''))
          const lbl = labelMap.get(idx)
          return { ...n, id: `${sessionId}-${n.id}`, medianYear: clusterMedianYears.get(idx) ?? null, ...(lbl ? { label: lbl.label, description: lbl.description, field: lbl.field } : {}) }
        }
        if (n.nodeType === 'paper' || n.nodeType === 'outlier') {
          const cid = (n as { clusterId?: string | null }).clusterId
          if (cid) return { ...n, clusterId: `${sessionId}-${cid}` }
          const nid = (n as { nearestClusterId?: string }).nearestClusterId
          if (nid) return { ...n, nearestClusterId: `${sessionId}-${nid}` }
        }
        return n
      }),
      edges: graph.edges.map((e) => ({
        ...e,
        source: e.source.startsWith('cluster-') ? `${sessionId}-${e.source}` : e.source,
        target: e.target.startsWith('cluster-') ? `${sessionId}-${e.target}` : e.target,
      })),
    }

    return Response.json({
      sessionId,
      graph: fixedGraph,
      ai_available: labelResult.ai_available,
      ai_reason: labelResult.reason,
    })
  } catch (err) {
    console.error('[session/create]', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return Response.json({ error: message }, { status: 500 })
  }
}
