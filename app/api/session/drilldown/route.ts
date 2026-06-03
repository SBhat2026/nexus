import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { fetchFromOpenAlex } from '@/lib/sources/openalex'
import { buildDrilldownSeed } from '@/lib/sources/drilldown'
import { getPapersWithEmbeddings } from '@/lib/papers/cache'
import { runClusteringPipeline } from '@/lib/clustering/pipeline'
import { cosineDistance } from '@/lib/clustering/dbscan'
import { buildGraph } from '@/lib/graphBuilder'
import { projectEmbeddings } from '@/lib/umap/project'
import { createServerClient } from '@/lib/supabase/server'
import { createAuthClient } from '@/utils/supabase/server'
import { labelClusters, type LabelResult } from '@/lib/anthropic/labelClusters'
import { labelClustersGroq } from '@/lib/groq/labelClusters'
import { writeProgress } from '@/lib/progress/writer'
import { enforceSessionCap } from '@/lib/sessions/cap'

export const maxDuration = 120

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parentSessionId: string = body.parentSessionId ?? ''
    const clusterId: string = body.clusterId ?? ''
    const clientSessionId: string | undefined = body.newSessionId
    const newSessionId =
      clientSessionId && UUID_RE.test(clientSessionId) ? clientSessionId : randomUUID()

    if (!parentSessionId || !clusterId) {
      return Response.json({ error: 'parentSessionId and clusterId required' }, { status: 400 })
    }

    // Auth-gated like Go Deeper.
    const authClient = await createAuthClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServerClient()

    // Load parent session (for depth) and the cluster (for label) + its papers.
    const [parentRes, clusterRes, clusterPapersRes] = await Promise.all([
      db.from('sessions').select('depth').eq('id', parentSessionId).single(),
      db.from('clusters').select('label').eq('id', clusterId).eq('session_id', parentSessionId).single(),
      db.from('papers').select('s2_paper_id,title,abstract').eq('session_id', parentSessionId).eq('cluster_id', clusterId),
    ])

    if (parentRes.error || !parentRes.data) {
      return Response.json({ error: 'Parent session not found' }, { status: 404 })
    }
    const parentDepth: number = parentRes.data.depth ?? 0
    const clusterLabel: string = clusterRes.data?.label ?? 'this cluster'
    const clusterPapers = (clusterPapersRes.data ?? []).map((p) => ({
      external_id: p.s2_paper_id as string,
      title: p.title as string,
      abstract: (p.abstract ?? '') as string,
    }))

    await writeProgress(newSessionId, 'fetching', `Drilling into "${clusterLabel}"`)

    // 1. Build sub-queries from the cluster, fetch additional papers from OpenAlex.
    const { queries, seedPaperIds } = await buildDrilldownSeed(clusterLabel, clusterPapers)
    const perQuery = 60
    const fetched = await Promise.allSettled(
      queries.map((q) => fetchFromOpenAlex({ q, field: 'search' }, perQuery)),
    )

    // Merge fetched OpenAlex ids with the parent cluster's paper ids, deduped.
    const mergedIds = new Set<string>(seedPaperIds)
    fetched.forEach((r) => {
      if (r.status === 'fulfilled') r.value.forEach((w) => mergedIds.add(w.id))
    })
    const allIds = [...mergedIds]

    if (allIds.length < 5) {
      return Response.json({ error: 'Not enough papers to drill into this cluster.' }, { status: 422 })
    }

    await writeProgress(newSessionId, 'embedding', `Embedding ${allIds.length} papers (reusing cached)`)

    // 2. Embeddings — getPapersWithEmbeddings reuses embedding_cache (parent cluster
    //    papers are already cached) and only embeds genuinely-new papers.
    const papers = await getPapersWithEmbeddings(allIds)
    const withEmbeddings = papers.filter((p) => p.embedding && p.embedding.length === 1024)

    if (withEmbeddings.length < 5) {
      return Response.json({
        error: `Insufficient papers with embeddings (${withEmbeddings.length}). Try a different cluster.`,
      }, { status: 422 })
    }

    // 3. Cluster + 2D projection.
    await writeProgress(newSessionId, 'clustering', 'Running PCA + UMAP + DBSCAN')
    const vectors = withEmbeddings.map((p) => p.embedding as number[])
    const pipeline = runClusteringPipeline(vectors)
    const umapCoords = projectEmbeddings(pipeline.pcaOut)

    // 4. Map papers.
    const papersMapped = withEmbeddings.map((p) => ({
      id: randomUUID(),
      s2PaperId: p.external_id,
      title: p.title,
      abstract: p.abstract ?? '',
      authors: p.authors ?? [],
      year: p.year ?? 0,
      citationCount: p.citation_count,
      referenceIds: [] as string[],
      s2Url: p.external_id.startsWith('core:')
        ? `https://core.ac.uk/works/${p.external_id.replace('core:', '')}`
        : `https://openalex.org/${p.external_id}`,
      venue: null as string | null,
    }))

    // 5. Representative papers per cluster (centroid-closest + top-2 citations).
    const representativeIds = new Set<string>()
    pipeline.clusters.forEach((c) => {
      if (c.memberIndices.length === 0) return
      let minDist = Infinity, centroidLocalIdx = -1
      c.memberIndices.forEach((pi) => {
        const d = cosineDistance(vectors[pi], c.center)
        if (d < minDist) { minDist = d; centroidLocalIdx = pi }
      })
      const centroidPaperId = centroidLocalIdx >= 0 ? papersMapped[centroidLocalIdx].id : null
      if (centroidPaperId) representativeIds.add(centroidPaperId)
      c.memberIndices
        .filter((pi) => papersMapped[pi].id !== centroidPaperId)
        .sort((a, b) => papersMapped[b].citationCount - papersMapped[a].citationCount)
        .slice(0, 2)
        .forEach((pi) => representativeIds.add(papersMapped[pi].id))
    })

    const graph = buildGraph(papersMapped, pipeline, umapCoords, representativeIds)

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

    // 6. Persist.
    await writeProgress(newSessionId, 'saving', 'Persisting graph')

    await db.from('sessions').insert({
      id: newSessionId,
      user_id: user.id,
      seed_topic: clusterLabel,
      data_source: 'openalex',
      is_saved: true,
      last_seen_at: new Date().toISOString(),
      parent_session_id: parentSessionId,
      parent_cluster_id: clusterId,
      depth: parentDepth + 1,
    })

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
        id: `${newSessionId}-cluster-${c.clusterIndex}`,
        session_id: newSessionId,
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
        const minimalRows = clusterRows.map((r) => ({
          id: r.id, session_id: r.session_id, label: r.label, description: r.description,
          center_embedding: r.center_embedding, paper_count: r.paper_count, field: r.field, is_pruned: r.is_pruned,
        }))
        await db.from('clusters').insert(minimalRows)
      }
    }

    // 7. AI labeling.
    await writeProgress(newSessionId, 'labeling', `Labeling ${pipeline.clusters.length} clusters`)
    const clusterInputs = pipeline.clusters.map((c) => ({
      clusterIndex: c.clusterIndex,
      papers: c.memberIndices
        .filter((i) => representativeIds.has(papersMapped[i].id))
        .slice(0, 5)
        .map((i) => ({ title: papersMapped[i].title, abstractPrefix: papersMapped[i].abstract.slice(0, 400) })),
    }))
    let labelResult: LabelResult = { labels: [], ai_available: false, reason: 'error' }
    try {
      labelResult = await Promise.any([
        labelClusters(clusterInputs, clusterLabel).then((r) => r.labels.length > 0 ? r : Promise.reject(new Error('empty'))),
        labelClustersGroq(clusterInputs, clusterLabel).then((r) => r.labels.length > 0 ? r : Promise.reject(new Error('empty'))),
      ])
    } catch (err) {
      console.warn('[session/drilldown] both labelers failed, using generic labels:', err)
    }
    const labels = labelResult.labels
    if (labels.length > 0) {
      await Promise.all(labels.map((l) =>
        db.from('clusters')
          .update({ label: l.label, description: l.description, field: l.field })
          .eq('id', `${newSessionId}-cluster-${l.clusterIndex}`)
          .eq('session_id', newSessionId)
      ))
    }

    const paperRows = papersMapped.map((p, i) => ({
      id: p.id,
      session_id: newSessionId,
      s2_paper_id: p.s2PaperId,
      title: p.title,
      abstract: p.abstract,
      authors: p.authors,
      year: p.year,
      citation_count: p.citationCount,
      embedding: withEmbeddings[i].embedding,
      cluster_id: pipeline.assignments[i] >= 0 ? `${newSessionId}-cluster-${pipeline.assignments[i]}` : null,
      is_outlier: pipeline.outlierFlags[i],
      is_representative: representativeIds.has(p.id),
      nearest_cluster_id: pipeline.nearestClusterIndex[i] >= 0 ? `${newSessionId}-cluster-${pipeline.nearestClusterIndex[i]}` : null,
      tldr: null,
      s2_url: p.s2Url,
      venue: p.venue ?? null,
      umap_x: umapCoords[i]?.[0] ?? null,
      umap_y: umapCoords[i]?.[1] ?? null,
    }))
    const edgeRows = graph.edges.slice(0, 500).map((e) => ({
      session_id: newSessionId,
      source_id: e.source,
      source_type: 'node',
      target_id: e.target,
      target_type: 'node',
      weight: e.weight,
      edge_type: e.edgeType,
    }))
    await Promise.all([
      paperRows.length > 0 ? db.from('papers').insert(paperRows) : Promise.resolve(),
      edgeRows.length > 0 ? db.from('edges').insert(edgeRows) : Promise.resolve(),
    ])

    // Drilling counts toward the saved-session cap, but never evict the active lineage.
    await enforceSessionCap(db, user.id, { exclude: [parentSessionId, newSessionId] })

    // Build session-scoped graph for the response (mirror create).
    const labelMap = new Map(labels.map((l) => [l.clusterIndex, l]))
    const fixedGraph = {
      nodes: graph.nodes.map((n) => {
        if (n.nodeType === 'cluster') {
          const idx = parseInt((n.id as string).replace('cluster-', ''))
          const lbl = labelMap.get(idx)
          return { ...n, id: `${newSessionId}-${n.id}`, medianYear: clusterMedianYears.get(idx) ?? null, ...(lbl ? { label: lbl.label, description: lbl.description, field: lbl.field } : {}) }
        }
        if (n.nodeType === 'paper' || n.nodeType === 'outlier') {
          const cid = (n as { clusterId?: string | null }).clusterId
          if (cid) return { ...n, clusterId: `${newSessionId}-${cid}` }
          const nid = (n as { nearestClusterId?: string }).nearestClusterId
          if (nid) return { ...n, nearestClusterId: `${newSessionId}-${nid}` }
        }
        return n
      }),
      edges: graph.edges.map((e) => ({
        ...e,
        source: e.source.startsWith('cluster-') ? `${newSessionId}-${e.source}` : e.source,
        target: e.target.startsWith('cluster-') ? `${newSessionId}-${e.target}` : e.target,
      })),
    }

    await writeProgress(newSessionId, 'ready')

    return Response.json({
      sessionId: newSessionId,
      graph: fixedGraph,
      ai_available: labelResult.ai_available,
      ai_reason: labelResult.reason,
    })
  } catch (err) {
    console.error('[session/drilldown]', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return Response.json({ error: message }, { status: 500 })
  }
}
