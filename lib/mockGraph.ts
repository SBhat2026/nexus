import type { GraphData, ClusterNode, PaperNode, DirectionNode, OutlierNode, GraphEdge } from './types'

// 3 clusters, 6 paper nodes, 2 direction nodes, 1 outlier = 12 nodes total
// (keeping graph lean for initial force layout)

const clusters: ClusterNode[] = [
  {
    id: 'c1',
    nodeType: 'cluster',
    label: 'Attention Mechanisms',
    description: 'Papers focused on self-attention, multi-head attention, and transformer architectures that improve sequence modeling efficiency.',
    paperCount: 3,
    field: 'machine_learning',
    isPruned: false,
  },
  {
    id: 'c2',
    nodeType: 'cluster',
    label: 'Efficient Transformers',
    description: 'Methods for reducing the quadratic complexity of full attention, including sparse attention and linear approximations.',
    paperCount: 2,
    field: 'systems',
    isPruned: false,
  },
  {
    id: 'c3',
    nodeType: 'cluster',
    label: 'Cross-Domain Transfer',
    description: 'Transfer learning approaches that adapt pretrained language models to new domains with limited supervision.',
    paperCount: 1,
    field: 'nlp',
    isPruned: false,
  },
]

const papers: PaperNode[] = [
  {
    id: 'p1',
    nodeType: 'paper',
    s2PaperId: 'mock-s2-001',
    title: 'Attention Is All You Need',
    abstract: 'We propose the Transformer, a model architecture eschewing recurrence and instead relying entirely on an attention mechanism.',
    authors: ['Vaswani et al.'],
    year: 2017,
    citationCount: 98000,
    clusterId: 'c1',
    isOutlier: false,
    tldr: 'Introduced the Transformer architecture based solely on attention mechanisms.',
    s2Url: 'https://api.semanticscholar.org/graph/v1/paper/search?query=attention+is+all+you+need',
  },
  {
    id: 'p2',
    nodeType: 'paper',
    s2PaperId: 'mock-s2-002',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers',
    abstract: 'We introduce BERT, which stands for Bidirectional Encoder Representations from Transformers.',
    authors: ['Devlin et al.'],
    year: 2018,
    citationCount: 72000,
    clusterId: 'c1',
    isOutlier: false,
    tldr: 'Bidirectional pre-training of transformers yields strong NLP representations.',
  },
  {
    id: 'p3',
    nodeType: 'paper',
    s2PaperId: 'mock-s2-003',
    title: 'Multi-Head Attention for Sequence-to-Sequence Learning',
    abstract: 'An exploration of multi-head attention variants and their impact on translation quality.',
    authors: ['Chen et al.'],
    year: 2019,
    citationCount: 4200,
    clusterId: 'c1',
    isOutlier: false,
  },
  {
    id: 'p4',
    nodeType: 'paper',
    s2PaperId: 'mock-s2-004',
    title: 'Longformer: The Long-Document Transformer',
    abstract: 'We present Longformer with an attention mechanism that scales linearly with sequence length.',
    authors: ['Beltagy et al.'],
    year: 2020,
    citationCount: 8500,
    clusterId: 'c2',
    isOutlier: false,
    tldr: 'Sparse attention pattern enables processing of long documents efficiently.',
  },
  {
    id: 'p5',
    nodeType: 'paper',
    s2PaperId: 'mock-s2-005',
    title: 'Linformer: Self-Attention with Linear Complexity',
    abstract: 'We show that the self-attention mechanism can be approximated by a low-rank matrix.',
    authors: ['Wang et al.'],
    year: 2020,
    citationCount: 3100,
    clusterId: 'c2',
    isOutlier: false,
  },
  {
    id: 'p6',
    nodeType: 'paper',
    s2PaperId: 'mock-s2-006',
    title: 'Domain-Adaptive Pretraining for Scientific NLP',
    abstract: 'Continued pretraining on domain-specific corpora significantly improves performance on scientific text tasks.',
    authors: ['Gururangan et al.'],
    year: 2020,
    citationCount: 6300,
    clusterId: 'c3',
    isOutlier: false,
    tldr: 'Domain-specific pretraining consistently boosts downstream scientific NLP.',
  },
]

const directions: DirectionNode[] = [
  {
    id: 'd1',
    nodeType: 'direction',
    title: 'Protein Sequence Attention for Function Prediction',
    description: 'Apply cross-domain transfer of transformer architectures trained on natural language to protein sequence modeling. Attention heads may capture residue-residue interactions analogously to syntactic dependencies in text.',
    noveltyScore: 8,
    feasibilityScore: 7,
    parentClusterId: 'c3',
    isFlagged: false,
    humanRating: null,
    rationale: 'Strong precedent from ESM-2 and ProtTrans; gap is in few-shot function annotation rather than structure.',
    suggestedNextSteps: ['Survey ESM-2 fine-tuning literature', 'Identify labeled function datasets (UniProt)'],
  },
  {
    id: 'd2',
    nodeType: 'direction',
    title: 'Linear Attention for Genomic Long-Range Dependencies',
    description: 'Genomic sequences regularly exceed 10k bp. Apply linear-complexity attention (Linformer / Hyena variants) to capture long-range enhancer-promoter interactions without full-sequence quadratic cost.',
    noveltyScore: 7,
    feasibilityScore: 8,
    parentClusterId: 'c2',
    isFlagged: false,
    humanRating: null,
    rationale: 'HyenaDNA demonstrates feasibility; opportunity to benchmark against Enformer on cell-type-specific expression.',
  },
]

const outlier: OutlierNode = {
  id: 'o1',
  nodeType: 'outlier',
  s2PaperId: 'mock-s2-out-001',
  title: 'Topological Data Analysis of Neural Network Loss Landscapes',
  abstract: 'We apply persistent homology to characterize the topological features of loss landscapes, finding that flatter minima correspond to lower Betti numbers.',
  authors: ['Rieck et al.'],
  year: 2021,
  citationCount: 890,
  mahalanobisDistance: 4.7,
  nearestClusterId: 'c1',
  overlapClusterIds: ['c1', 'c2'],
  outlierExplanation: 'Uses topological methods from pure mathematics to analyze neural network training dynamics — structurally distinct from the attention/NLP cluster but potentially relevant if exploring optimization geometry.',
  bridgePotential: 'Could bridge to protein energy landscape analysis, where flat basins may correspond to functional conformational flexibility.',
  isFlagged: false,
}

const edges: GraphEdge[] = [
  // cluster → paper membership (semantic_similarity)
  { id: 'e1', source: 'c1', target: 'p1', edgeType: 'semantic_similarity', weight: 0.95 },
  { id: 'e2', source: 'c1', target: 'p2', edgeType: 'semantic_similarity', weight: 0.92 },
  { id: 'e3', source: 'c1', target: 'p3', edgeType: 'semantic_similarity', weight: 0.88 },
  { id: 'e4', source: 'c2', target: 'p4', edgeType: 'semantic_similarity', weight: 0.91 },
  { id: 'e5', source: 'c2', target: 'p5', edgeType: 'semantic_similarity', weight: 0.89 },
  { id: 'e6', source: 'c3', target: 'p6', edgeType: 'semantic_similarity', weight: 0.87 },
  // citation edges
  { id: 'e7', source: 'p2', target: 'p1', edgeType: 'citation', weight: 1 },
  { id: 'e8', source: 'p3', target: 'p1', edgeType: 'citation', weight: 1 },
  { id: 'e9', source: 'p4', target: 'p1', edgeType: 'citation', weight: 1 },
  { id: 'e10', source: 'p5', target: 'p4', edgeType: 'citation', weight: 1 },
  { id: 'e11', source: 'p6', target: 'p2', edgeType: 'citation', weight: 1 },
  // direction → parent cluster
  { id: 'e12', source: 'c3', target: 'd1', edgeType: 'generated_from', weight: 0.8 },
  { id: 'e13', source: 'c2', target: 'd2', edgeType: 'generated_from', weight: 0.8 },
  // outlier weak link to nearest cluster
  { id: 'e14', source: 'c1', target: 'o1', edgeType: 'semantic_similarity', weight: 0.3 },
]

export const MOCK_GRAPH: GraphData = {
  nodes: [...clusters, ...papers, directions[0], directions[1], outlier],
  edges,
}
