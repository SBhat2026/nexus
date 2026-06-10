export type NodeType = 'paper' | 'cluster' | 'direction' | 'outlier'

export interface BaseNode {
  id: string
  nodeType: NodeType
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
  umapX?: number
  umapY?: number
}

export interface PaperNode extends BaseNode {
  nodeType: 'paper'
  s2PaperId: string
  title: string
  abstract: string
  authors: string[]
  year: number
  citationCount: number
  clusterId: string | null
  isOutlier: boolean
  isRepresentative?: boolean
  tldr?: string
  pdfUrl?: string
  s2Url?: string
  venue?: string | null
}

export interface ClusterNode extends BaseNode {
  nodeType: 'cluster'
  label: string
  description: string
  paperCount: number
  field: string
  isPruned: boolean
  pruneReason?: string
  clusterQuality?: number
  generation?: number  // 1 = initial; 2+ = Go Deeper rounds
  medianYear?: number | null
  drilldownCount?: number  // number of child sessions drilled from this cluster
  color?: string  // user-chosen hex override; falls back to default cluster blue
}

export interface DirectionNode extends BaseNode {
  nodeType: 'direction'
  title: string
  description: string
  noveltyScore: number
  feasibilityScore: number
  parentClusterId: string | null
  isFlagged: boolean
  humanRating: number | null
  rationale?: string
  suggestedNextSteps?: string[]
}

export interface OutlierNode extends BaseNode {
  nodeType: 'outlier'
  s2PaperId: string
  title: string
  abstract: string
  authors: string[]
  year: number
  citationCount: number
  mahalanobisDistance: number
  nearestClusterId: string
  overlapClusterIds: string[]
  outlierExplanation?: string
  bridgePotential?: string
  isFlagged: boolean
  venue?: string | null
}

export type GraphNode = PaperNode | ClusterNode | DirectionNode | OutlierNode

export type EdgeType = 'citation' | 'semantic_similarity' | 'generated_from'

export interface GraphEdge {
  id: string
  source: string
  target: string
  edgeType: EdgeType
  weight: number
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ─── AI co-pilot graph editing ─────────────────────────────────────────────
// Structured, reviewable changes the LLM may propose. Always previewed before apply.
export type GraphEditAction =
  | { type: 'add_node'; nodeType: 'cluster' | 'paper'; label: string; description?: string; clusterId?: string; confidence: number; reason: string }
  | { type: 'remove_node'; targetId: string; confidence: number; reason: string }
  | { type: 'add_edge'; sourceId: string; targetId: string; edgeType?: EdgeType; confidence: number; reason: string }
  | { type: 'remove_edge'; edgeId: string; confidence: number; reason: string }
  // Rename a cluster (writes clusters.custom_label; precedence over the AI label).
  | { type: 'rename_cluster'; targetId: string; newLabel: string; confidence: number; reason: string }
  // Move a paper into another cluster, or detach it (clusterId = null).
  | { type: 'assign_paper'; paperId: string; clusterId: string | null; confidence: number; reason: string }
  // Fold sourceId's papers into targetId, then delete the (now empty) source cluster.
  | { type: 'merge_clusters'; sourceId: string; targetId: string; confidence: number; reason: string }
  // Exclude / re-include a cluster from the active map (curation, replayed on reload).
  | { type: 'prune_cluster'; targetId: string; reason: string; confidence: number }
  | { type: 'unprune_cluster'; targetId: string; confidence: number; reason: string }

// In-place field changes applied to existing nodes (rename, reassignment, count refresh).
export interface GraphNodePatch {
  id: string
  changes: Record<string, unknown>
}

// Result of applying a batch of edits, returned by /api/session/[id]/graph-edit.
export interface GraphEditResult {
  addedNodes: GraphNode[]
  addedEdges: GraphEdge[]
  removedNodeIds: string[]
  removedEdgeIds: string[]
  // Existing nodes whose fields changed (label, clusterId, paperCount, …).
  updatedNodes: GraphNodePatch[]
  skipped: { action: GraphEditAction; reason: string }[]
}

export interface LayerToggles {
  papers: boolean
  directions: boolean
  outliers: boolean
  pruned: boolean
  citationEdges: boolean
  semanticEdges: boolean
  generatedEdges: boolean
}

export interface LogEntry {
  id: string
  timestamp: number
  actionType: 'prune' | 'flag' | 'annotate' | 'expand' | 'reframe' | 'generate' | 'select'
  targetId: string
  targetType: NodeType
  note?: string
  label?: string
}

// Per-session record of how papers were sourced — surfaced in the Zone A
// "Source Intelligence" panel and used by the wrong-domain re-run. Mirrors the
// jsonb persisted in sessions.source_intelligence (migration 0021).
export interface SourceIntelligence {
  detectedDomain: string | null
  ambiguousTerms: string[]
  subQueries: string[]
  papersFiltered: number
  relevanceThreshold: number | null
  relevanceWarning: string | null
  totalFetched: number
  totalClustered: number
  forcedDomain: string | null
}
