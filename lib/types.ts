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
  tldr?: string
  pdfUrl?: string
  s2Url?: string
}

export interface ClusterNode extends BaseNode {
  nodeType: 'cluster'
  label: string
  description: string
  paperCount: number
  field: string
  isPruned: boolean
  pruneReason?: string
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
