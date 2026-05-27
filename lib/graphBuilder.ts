import type {
  GraphData,
  ClusterNode,
  PaperNode,
  OutlierNode,
  GraphEdge,
} from './types'
import type { PipelineResult } from './clustering/pipeline'

interface RawPaper {
  id: string           // UUID assigned in session
  s2PaperId: string
  title: string
  abstract: string
  authors: string[]
  year: number
  citationCount: number
  tldr?: string
  s2Url?: string
  referenceIds?: string[]
  venue?: string | null
}

const FIELD_PALETTE = [
  'machine_learning', 'systems', 'nlp', 'biology', 'chemistry',
  'physics', 'economics', 'neuroscience', 'mathematics', 'climate',
]

export function buildGraph(
  papers: RawPaper[],
  pipeline: PipelineResult,
  umapCoords?: [number, number][],
  representativeIds?: Set<string>
): GraphData {
  const nodes: GraphData['nodes'] = []
  const edges: GraphEdge[] = []

  // Compute UMAP centroids per cluster
  const clusterCentroids = new Map<number, [number, number]>()
  if (umapCoords) {
    pipeline.clusters.forEach((c) => {
      const xs = c.memberIndices.map((i) => umapCoords[i][0])
      const ys = c.memberIndices.map((i) => umapCoords[i][1])
      clusterCentroids.set(c.clusterIndex, [
        xs.reduce((a, b) => a + b, 0) / xs.length,
        ys.reduce((a, b) => a + b, 0) / ys.length,
      ])
    })
  }

  // Cluster nodes
  pipeline.clusters.forEach((c) => {
    const nodeId = `cluster-${c.clusterIndex}`
    const field = FIELD_PALETTE[c.clusterIndex % FIELD_PALETTE.length]
    const umapCentroid = clusterCentroids.get(c.clusterIndex)
    const clusterNode: ClusterNode = {
      id: nodeId,
      nodeType: 'cluster',
      label: `Cluster ${String.fromCharCode(65 + c.clusterIndex)} (${c.memberIndices.length})`,
      description: `Semantic cluster containing ${c.memberIndices.length} papers.`,
      paperCount: c.memberIndices.length,
      field,
      isPruned: false,
      clusterQuality: pipeline.clusterQuality[c.clusterIndex],
      umapX: umapCentroid?.[0],
      umapY: umapCentroid?.[1],
    }
    nodes.push(clusterNode)
  })

  // Paper and outlier nodes
  const paperIdSet = new Set(papers.map((p) => p.s2PaperId))

  papers.forEach((paper, i) => {
    const isOutlier = pipeline.outlierFlags[i]
    const clusterIdx = pipeline.assignments[i]
    const paperUmap = umapCoords?.[i]

    if (isOutlier) {
      const nearestIdx = pipeline.nearestClusterIndex[i]
      const nearestClusterId = nearestIdx >= 0 ? `cluster-${nearestIdx}` : null
      const outlierNode: OutlierNode = {
        id: paper.id,
        nodeType: 'outlier',
        s2PaperId: paper.s2PaperId,
        title: paper.title,
        abstract: paper.abstract,
        authors: paper.authors,
        year: paper.year,
        citationCount: paper.citationCount,
        mahalanobisDistance: pipeline.outlierDistances[i],
        nearestClusterId: nearestClusterId ?? '',
        overlapClusterIds: nearestClusterId ? [nearestClusterId] : [],
        isFlagged: false,
        umapX: paperUmap?.[0],
        umapY: paperUmap?.[1],
      }
      nodes.push(outlierNode)

      if (nearestClusterId) {
        edges.push({
          id: `e-outlier-${paper.id}`,
          source: nearestClusterId,
          target: paper.id,
          edgeType: 'semantic_similarity',
          weight: parseFloat((1 - pipeline.outlierDistances[i]).toFixed(3)),
        })
      }
    } else {
      const paperNode: PaperNode = {
        id: paper.id,
        nodeType: 'paper',
        s2PaperId: paper.s2PaperId,
        title: paper.title,
        abstract: paper.abstract,
        authors: paper.authors,
        year: paper.year,
        citationCount: paper.citationCount,
        clusterId: clusterIdx >= 0 ? `cluster-${clusterIdx}` : null,
        isOutlier: false,
        isRepresentative: representativeIds?.has(paper.id) ?? false,
        tldr: paper.tldr,
        s2Url: paper.s2Url ?? `https://openalex.org/${paper.s2PaperId}`,
        venue: paper.venue ?? null,
        umapX: paperUmap?.[0],
        umapY: paperUmap?.[1],
      }
      nodes.push(paperNode)

      if (clusterIdx >= 0) {
        edges.push({
          id: `e-cluster-${paper.id}`,
          source: `cluster-${clusterIdx}`,
          target: paper.id,
          edgeType: 'semantic_similarity',
          weight: 0.9,
        })
      }
    }

    // Citation edges within the fetched set
    if (paper.referenceIds) {
      paper.referenceIds.forEach((refId) => {
        if (paperIdSet.has(refId)) {
          const targetPaper = papers.find((p) => p.s2PaperId === refId)
          if (targetPaper) {
            edges.push({
              id: `e-cite-${paper.id}-${targetPaper.id}`,
              source: paper.id,
              target: targetPaper.id,
              edgeType: 'citation',
              weight: 1,
            })
          }
        }
      })
    }
  })

  return { nodes, edges }
}
