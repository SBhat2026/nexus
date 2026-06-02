/**
 * Nexus roadmap — single source of truth for what's shipped and what's next.
 *
 * Update this file whenever:
 * - A new feature is started → add as { status: 'in-progress' }
 * - A feature ships → flip status to 'shipped', set shippedAt
 * - Scope changes → update description, eta
 *
 * Surfaced on the home page and at /roadmap.
 */

export type RoadmapStatus = 'shipped' | 'in-progress' | 'next' | 'exploring'

export interface RoadmapItem {
  id: string
  title: string
  description: string
  status: RoadmapStatus
  tier: 1 | 2 | 3 // 1 = core, 2 = polish, 3 = nice-to-have
  eta?: string // human-readable, e.g. "Q3 2026", "this week"
  shippedAt?: string // ISO date, only when status = 'shipped'
  tags?: string[]
}

export const ROADMAP: RoadmapItem[] = [
  // ─── Shipped ────────────────────────────────────────────────────────
  {
    id: 'phase-1-scaffold',
    title: 'Phase 1 — Core exploration scaffold',
    description:
      'Topic input, D3 graph canvas, cluster detection, outlier flagging, AI-generated research directions, Supabase auth, session heartbeat.',
    status: 'shipped',
    tier: 1,
    shippedAt: '2026-05-24',
    tags: ['core'],
  },
  {
    id: 'preview-graph',
    title: 'Landing preview graph',
    description: 'Animated mini-graph on landing page showing what a real session looks like.',
    status: 'shipped',
    tier: 2,
    shippedAt: '2026-05-25',
    tags: ['landing', 'polish'],
  },

  {
    id: 'home-redesign',
    title: 'Home page redesign + interactive background',
    description:
      'Mouse-reactive particle network behind the hero, scroll-driven roadmap section, refined typography, and live preview interactions.',
    status: 'shipped',
    tier: 2,
    shippedAt: '2026-06-02',
    tags: ['landing', 'polish'],
  },
  {
    id: 'session-persistence',
    title: 'Full session persistence',
    description:
      'Every session — nodes, edges, clusters, prunes, and flags — written through to the database as you work. Resume any session from any device; nothing is lost on tab close.',
    status: 'shipped',
    tier: 1,
    shippedAt: '2026-06-02',
    tags: ['core', 'storage'],
  },

  {
    id: 'snapshots-undo',
    title: 'Snapshots & undo timeline',
    description:
      'Checkpoint your exploration into immutable snapshots. Undo/redo with ⌘Z, scrub a branching history timeline, and revert to any prior state — forking a new line rather than losing work.',
    status: 'shipped',
    tier: 1,
    shippedAt: '2026-06-02',
    tags: ['core', 'history'],
  },

  {
    id: 'ai-graph-modification',
    title: 'AI co-pilot graph editing',
    description:
      'Claude and Llama propose structured changes — add concepts, link clusters, prune dead ends — with confidence scores, a preview-before-apply modal, per-edit toggles, and a full audit trail. Move from advisor to collaborator.',
    status: 'shipped',
    tier: 1,
    shippedAt: '2026-06-02',
    tags: ['ai', 'core'],
  },

  // ─── Tier 2 (polish) ─────────────────────────────────────────────────
  {
    id: 'session-management',
    title: 'Session management UI',
    description: 'Rename, duplicate, favorite, archive, and tag your saved sessions. Search across all your past explorations.',
    status: 'next',
    tier: 2,
    eta: 'Q4 2026',
    tags: ['ux'],
  },
  {
    id: 'graph-export',
    title: 'Publication-ready graph export',
    description: 'Export your graph as SVG, PNG, or a shareable read-only link. Vector formats preserved for use in papers and slides.',
    status: 'next',
    tier: 2,
    eta: 'Q4 2026',
    tags: ['export', 'sharing'],
  },
  {
    id: 'chat-streaming',
    title: 'Streaming chat responses',
    description: 'Token-by-token streaming for the AI co-pilot. Faster perceived response time, especially for long syntheses.',
    status: 'next',
    tier: 2,
    eta: 'Q4 2026',
    tags: ['ai', 'ux'],
  },

  // ─── Exploring ───────────────────────────────────────────────────────
  {
    id: 'collaboration',
    title: 'Multiplayer sessions',
    description: 'Invite collaborators to a live session. See cursors, comments, and edits in real time. Built on Supabase realtime.',
    status: 'exploring',
    tier: 3,
    tags: ['collab'],
  },
  {
    id: 'cite-export',
    title: 'BibTeX / Zotero export',
    description: 'One-click export of flagged papers into BibTeX, RIS, or directly into your Zotero library.',
    status: 'exploring',
    tier: 3,
    tags: ['export'],
  },
  {
    id: 'embeddings-search',
    title: 'Semantic similarity search within session',
    description:
      'Drop a paper, paragraph, or idea — find the nodes in your current graph that are semantically closest using pgvector ANN.',
    status: 'exploring',
    tier: 3,
    tags: ['ai', 'search'],
  },
]

export function getRoadmapByStatus(status: RoadmapStatus): RoadmapItem[] {
  return ROADMAP.filter((item) => item.status === status)
}

export function getShippedCount(): number {
  return getRoadmapByStatus('shipped').length
}

export function getInProgressCount(): number {
  return getRoadmapByStatus('in-progress').length
}
