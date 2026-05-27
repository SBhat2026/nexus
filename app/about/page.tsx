'use client'

import { useState, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ChevronDown,
  Search, GitBranch, Flag, MessageSquare, Key,
  Sun, Moon, Zap, Layers, RefreshCw, Database, Code2, BookOpen,
} from 'lucide-react'
import { useSessionStore } from '@/store/useSessionStore'
import NexusLogo from '@/components/NexusLogo'

// ─── Shared primitives ────────────────────────────────────────────────────────

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="shrink-0 font-mono text-xs text-slate-400 dark:text-slate-500 mt-0.5 w-5 text-right">{n}</span>
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-0.5">{title}</p>
        <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

function Kv({ term, children }: { term: string; children: ReactNode }) {
  return (
    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
      <span className="font-medium text-slate-800 dark:text-slate-200">{term} — </span>{children}
    </p>
  )
}

function Mono({ children }: { children: string }) {
  return (
    <code className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs font-mono">
      {children}
    </code>
  )
}

// ─── Section content ──────────────────────────────────────────────────────────

const HOW_TO_USE: ReactNode = (
  <div className="space-y-5">
    <Step n="01" title="Enter a seed topic">
      Type any research topic — as broad as &ldquo;diffusion models&rdquo; or as specific as
      &ldquo;single-cell RNA velocity in neurogenesis&rdquo;. Specificity produces tighter clusters.
      Nexus fetches up to 85 papers from OpenAlex using a 70/30 recency split (70% from the last
      3 years, 30% unconstrained), embeds them with Jina AI (1024-dim vectors), then runs the full
      clustering pipeline.
    </Step>
    <Step n="02" title="Read the cluster map">
      Papers are grouped by semantic similarity into named clusters visible in both the graph and
      the left sidebar. Each cluster is AI-labeled with a short name and a brief description. Click
      any cluster in the sidebar — or on the graph — to jump to it and expand its papers. Clusters
      show a median publication year; an amber dashed ring indicates the cluster&apos;s work skews
      older than 3 years.
    </Step>
    <Step n="03" title="Prune off-topic clusters">
      Select a cluster &rarr; &ldquo;Prune this cluster&rdquo; &rarr; add a reason. Pruned clusters
      are grayed out. Your stated reason is forwarded to direction generation as an explicit
      constraint — the AI treats it as what to avoid, not just metadata.
    </Step>
    <Step n="04" title="Go Deeper on a paper">
      Select any paper or outlier node, then click &ldquo;Go Deeper&rdquo; in the sidebar. Nexus
      fetches that paper&apos;s cited references from OpenAlex and runs the full embedding +
      clustering pipeline on them, creating a new labeled round of clusters. Each round is numbered
      in the sidebar: <strong>Initial &rarr; Round 2 &rarr; Round 3&hellip;</strong>
    </Step>
    <Step n="05" title="Generate research directions">
      Select a cluster or outlier and hit &ldquo;Generate research directions&rdquo;. An AI model
      reads the cluster&apos;s papers, your pruning decisions, and the map structure to propose
      3&ndash;5 specific, actionable directions — each scored for novelty and feasibility (1&ndash;10).
      Click &ldquo;Verify novelty&rdquo; on any direction to cross-check it against the existing
      literature via OpenAlex.
    </Step>
    <Step n="06" title="Ask the research assistant">
      The floating chat bar at the bottom of the graph accepts free-form questions about your map:
      compare clusters, identify gaps, ask what to explore next. The assistant has full context —
      all cluster labels, your selected node&apos;s complete metadata, pruned clusters, and generated
      directions. Select a node before asking for the most grounded answers.
    </Step>
    <Step n="07" title="Filter by date range">
      Open the left sidebar&apos;s date filter section, set a publication year range, and click
      &ldquo;Apply &amp; re-cluster&rdquo;. Nexus re-clusters the already-fetched papers server-side
      without making new API calls — typically 3&ndash;8 seconds. Use this to focus on recent work
      or to compare how cluster structure changes across decades.
    </Step>
    <Step n="08" title="Focus on a cluster">
      Select a cluster &rarr; &ldquo;Focus on this cluster&rdquo; in the right sidebar. All other
      clusters and their papers dim to 15% opacity so you can study one area without distraction.
      Press <strong>ESC</strong> or click &ldquo;Exit focus mode&rdquo; to clear. Focus state is
      session-only and is not exported.
    </Step>
    <Step n="09" title="Mark papers as read">
      Select a paper &rarr; &ldquo;Mark as read&rdquo; in the right sidebar. Read papers dim on the
      graph so you can track what you&apos;ve processed. Cleared on page reload (session-only).
    </Step>
    <Step n="10" title="Iterate and revisit">
      Prune, go deeper, generate directions, ask follow-up questions. Your graph state — including
      all Go Deeper rounds and generated directions — is saved automatically and survives browser
      refresh within the same tab.
    </Step>
  </div>
)

const AI_FEATURES: ReactNode = (
  <div className="space-y-4">
    <Kv term="Cluster labeling">
      When a session is created — and after each Go Deeper round — an AI model reads a sample of
      each cluster&apos;s papers and assigns a concise semantic label and description. Labels are
      specific: &ldquo;CRISPR base-editing off-target safety&rdquo; rather than &ldquo;Biology&rdquo;.
    </Kv>
    <Kv term="Research directions">
      On-demand when you click &ldquo;Generate research directions&rdquo;. By default uses Llama 3.3
      70B (free, via Groq). Add your own Claude key to upgrade to Claude Sonnet 4.6.
    </Kv>
    <Kv term="Novelty verification">
      Manual per-direction via &ldquo;Verify novelty&rdquo;. Searches OpenAlex for the closest
      existing work and computes a literature coverage score: <strong>Low (&lt;30%)</strong> means
      sparse prior art and higher novelty; <strong>High (&gt;70%)</strong> means the direction is
      well-explored. Returns the 3 most relevant existing papers with citation counts and OpenAlex
      links. The AI-assigned novelty score (1&ndash;10) is now labeled &ldquo;AI estimate&rdquo; to
      distinguish it from the verified coverage label.
    </Kv>
    <Kv term="Go Deeper clustering">
      When you expand a paper, the fetched references go through the same full pipeline (embedding
      &rarr; PCA &rarr; UMAP 15D &rarr; DBSCAN &rarr; AI labeling) as the initial session. New
      clusters are independent of the original ones — they reveal the subfield shown by that
      paper&apos;s citation network.
    </Kv>
    <Kv term="Research assistant">
      The chat bar uses the same Llama 3.3 / Claude Sonnet switch as directions. Every message
      carries rich per-node context: for papers — title, year, authors, abstract, citation count;
      for clusters — label, description, paper count, median year; for directions — rationale,
      novelty and feasibility scores, suggested next steps; for outliers — Mahalanobis distance,
      bridge potential, and outlier explanation. Select a node before asking for grounded answers.
    </Kv>
    <Kv term="When AI is paused">
      If the banner appears at the top of the explorer, cluster labeling, research directions, Go
      Deeper, and the chat assistant are all unavailable. The paper graph, sidebar navigation,
      pruning, flagging, and JSON export continue normally. A BYOK Claude key bypasses the shared
      quota for directions and the assistant.
    </Kv>
  </div>
)

const BYOK: ReactNode = (
  <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
    <p>
      Open the left sidebar &rarr; <span className="font-medium text-slate-800 dark:text-slate-200">AI
      Model</span> section &rarr; paste a key starting with <Mono>sk-ant-</Mono>. This upgrades
      direction generation and the chat assistant from Llama 3.3 to Claude Sonnet 4.6, and lets you
      continue using AI features even when the shared Groq quota is exhausted.
    </p>
    <p>
      <span className="font-medium text-slate-800 dark:text-slate-200">Privacy:</span> your key is
      stored only in your browser&apos;s <Mono>sessionStorage</Mono> — never written to a database
      or logged server-side. It leaves your browser only as the <Mono>x-anthropic-key</Mono> header
      on direct API calls, and is cleared when you close the tab.
    </p>
  </div>
)

const PRUNING: ReactNode = (
  <div className="space-y-4">
    <Kv term="Pruning">
      Removes a cluster from the active view and passes your stated reason to direction generation
      as an explicit constraint. The AI avoids generating directions in pruned areas. You can
      un-prune at any time from the cluster&apos;s right sidebar panel.
    </Kv>
    <Kv term="Flagging">
      Marks a paper, cluster, direction, or outlier for follow-up. Flagged items appear in the
      left sidebar&apos;s Flagged list so you can jump back to them, and are preserved in the
      exported JSON.
    </Kv>
  </div>
)

const GRAPH_LEGEND: ReactNode = (
  <div className="space-y-4">
    {[
      {
        symbol: '●', color: 'text-blue-500 dark:text-blue-400', label: 'Cluster node',
        desc: <span>A group of semantically similar papers. AI-labeled. Size reflects paper count.
          Shows median publication year of member papers. An amber dashed outer ring means the
          cluster&apos;s median year is more than 3 years old — the work may predate recent
          developments. Clusters from Go Deeper rounds appear under their round number in the
          sidebar (Initial, Round 2, Round 3&hellip;). Click to expand papers.</span>,
      },
      {
        symbol: '●', color: 'text-slate-400 dark:text-slate-300', label: 'Paper node',
        desc: <span>A single paper. Visible when you expand its cluster from the sidebar. Click to
          see title, abstract, authors, year, and citation count in the right panel.</span>,
      },
      {
        symbol: '◈', color: 'text-amber-500 dark:text-amber-400', label: 'Outlier node',
        desc: <span>A paper that doesn&apos;t fit cleanly into any cluster — often a bridge between
          fields. Shown with Mahalanobis distance from its nearest cluster. Good candidates for
          Go Deeper.</span>,
      },
      {
        symbol: '⬡', color: 'text-purple-500 dark:text-purple-400', label: 'Direction node',
        desc: <span>An AI-generated research direction linked to its source cluster by a dashed
          edge. Shows novelty and feasibility scores (1&ndash;10). Flag it to track promising
          directions.</span>,
      },
    ].map(item => (
      <div key={item.label} className="flex items-start gap-3">
        <span className={`${item.color} text-xl leading-none mt-0.5 w-5 text-center shrink-0`}>{item.symbol}</span>
        <div className="text-sm">
          <span className="font-medium text-slate-800 dark:text-slate-200">{item.label} — </span>
          <span className="text-slate-600 dark:text-slate-400">{item.desc}</span>
        </div>
      </div>
    ))}
  </div>
)

const PRIVACY: ReactNode = (
  <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
    <p>Session graphs and paper embeddings are stored in Supabase (Postgres + pgvector). Paper
      metadata comes from OpenAlex (fully open access). Embeddings are cached by paper ID and
      shared across sessions — a paper embedded for one session is instantly available for
      another&apos;s.</p>
    <p>Sessions require no authentication. Session data (papers, clusters, directions) persists in
      Supabase indefinitely; graph state is also cached in your browser&apos;s <Mono>sessionStorage</Mono> for
      fast revisits within the same tab.</p>
    <p>Groq (Llama 3.3) is used for labeling and directions by default. If you provide a BYOK
      Claude key, only that key is used — the server forwards it directly to Anthropic and does not
      retain it. Chat messages are not logged server-side.</p>
  </div>
)

const TECH_STACK: ReactNode = (
  <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-disc list-inside">
    <li>Next.js 16 (App Router) + TypeScript + Tailwind v4</li>
    <li>D3 force simulation for graph layout; UMAP 2D for cluster positioning</li>
    <li>OpenAlex for paper metadata (open access, no API key required)</li>
    <li>Jina AI <Mono>jina-embeddings-v3</Mono> — 1024-dimensional paper vectors</li>
    <li>PCA &rarr; UMAP 15D &rarr; DBSCAN for clustering; cosine distance throughout</li>
    <li>Supabase (Postgres + pgvector) for session, paper, cluster, and edge persistence</li>
    <li>Anthropic Claude Sonnet 4.6 — cluster labeling, BYOK directions, BYOK chat</li>
    <li>Groq Llama 3.3 70B — default direction generation and chat assistant</li>
  </ul>
)

// ─── Section manifest ─────────────────────────────────────────────────────────

interface Section {
  id: string
  icon: React.ElementType
  title: string
  subtitle: string
  content: ReactNode
}

const SECTIONS: Section[] = [
  { id: 'how-to-use', icon: Search,      title: 'How to use it',        subtitle: 'Step-by-step: from seed topic to iterative research exploration',     content: HOW_TO_USE },
  { id: 'ai',         icon: Zap,          title: 'AI features',          subtitle: 'What each AI-powered capability does and when it runs',               content: AI_FEATURES },
  { id: 'byok',       icon: Key,          title: 'Bring your own key',   subtitle: 'Upgrade to Claude Sonnet and bypass the shared Groq quota',           content: BYOK },
  { id: 'pruning',    icon: Flag,         title: 'Pruning & flagging',   subtitle: 'How to shape the map and mark items for follow-up',                   content: PRUNING },
  { id: 'graph',      icon: BookOpen,     title: 'Graph legend',         subtitle: 'What each node type represents and how to read the layout',           content: GRAPH_LEGEND },
  { id: 'privacy',    icon: Database,     title: 'Privacy & data',       subtitle: "What's stored, where, and for how long",                              content: PRIVACY },
  { id: 'stack',      icon: Code2,        title: 'Tech stack',           subtitle: 'The tools and models powering Nexus',                                 content: TECH_STACK },
]

// Unused imports silenced — these are referenced in SECTIONS above
void Layers; void GitBranch; void RefreshCw; void MessageSquare;

// ─── Accordion item ───────────────────────────────────────────────────────────

function AccordionItem({
  section, isOpen, onToggle, sectionRef,
}: {
  section: Section
  isOpen: boolean
  onToggle: () => void
  sectionRef: (el: HTMLElement | null) => void
}) {
  const Icon = section.icon
  return (
    <div
      ref={sectionRef}
      id={section.id}
      className="border border-slate-200 dark:border-slate-700/60 rounded-xl overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
      >
        <div className="shrink-0 w-9 h-9 rounded-lg bg-blue-600/10 dark:bg-blue-500/15 border border-blue-500/20 dark:border-blue-500/25 flex items-center justify-center">
          <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">{section.title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{section.subtitle}</p>
        </div>
        <ChevronDown
          className={`shrink-0 w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Smooth expand using CSS grid row animation */}
      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-5 pt-4 pb-6 border-t border-slate-100 dark:border-slate-800">
            {section.content}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  const { isDark, toggleTheme } = useSessionStore()
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const sectionEls = useRef<Record<string, HTMLElement | null>>({})

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function jumpTo(id: string) {
    setOpenSections(prev => new Set([...prev, id]))
    setTimeout(() => {
      sectionEls.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  return (
    <div className={`min-h-screen bg-white dark:bg-[#020817] ${isDark ? 'dark' : ''}`}>
      <main className="max-w-2xl mx-auto px-6 py-16">

        {/* Top nav */}
        <div className="flex items-center justify-between mb-12">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Nexus
          </Link>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-slate-50 dark:from-blue-950/30 dark:to-slate-900 border border-blue-100 dark:border-blue-900/40 px-6 py-7 mb-10">
          <div className="flex items-center gap-3 mb-3">
            <NexusLogo size={36} />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">About Nexus</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
            Nexus is an AI-powered research navigator — the Google Maps of academic literature. Enter
            a topic and it builds a live semantic map: clustering papers by conceptual similarity,
            AI-labeling each cluster, surfacing outlier papers that bridge fields, and generating
            novel research directions. Drill deeper iteratively through multiple rounds of exploration,
            ask a built-in research assistant questions about your map, and export everything as JSON.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {['OpenAlex', 'Jina AI', 'UMAP · DBSCAN', 'Claude Sonnet', 'Llama 3.3'].map(t => (
              <span key={t} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/70 dark:bg-slate-800/70 border border-blue-200/60 dark:border-blue-800/40 text-blue-700 dark:text-blue-400">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Quick-navigation chips */}
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
            Jump to section
          </p>
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map(s => {
              const Icon = s.icon
              return (
                <button
                  key={s.id}
                  onClick={() => jumpTo(s.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-600 text-xs text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {s.title}
                </button>
              )
            })}
          </div>
        </div>

        {/* Accordion */}
        <div className="space-y-3 mb-14">
          {SECTIONS.map(section => (
            <AccordionItem
              key={section.id}
              section={section}
              isOpen={openSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
              sectionRef={el => { sectionEls.current[section.id] = el }}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-700/50 pt-8">
          <div className="grid grid-cols-2 gap-6 text-xs text-slate-500 dark:text-slate-400 mb-6">
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Resources</p>
              <ul className="space-y-1.5">
                <li>
                  <a href="https://github.com/SBhat2026/nexus" target="_blank" rel="noopener noreferrer"
                    className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                    Source code on GitHub ↗
                  </a>
                </li>
                <li>
                  <a href="https://openalex.org" target="_blank" rel="noopener noreferrer"
                    className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                    OpenAlex (paper data) ↗
                  </a>
                </li>
                <li>
                  <a href="https://jina.ai" target="_blank" rel="noopener noreferrer"
                    className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                    Jina AI (embeddings) ↗
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">What&apos;s live</p>
              <ul className="space-y-1.5 text-slate-400 dark:text-slate-500">
                <li>Recency-biased paper fetch</li>
                <li>Multi-round Go Deeper clustering</li>
                <li>Novelty verification via OpenAlex</li>
                <li>DB-backed read tracking</li>
                <li>Date-range re-clustering</li>
                <li>Focus mode, paper filters</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-slate-300 dark:text-slate-700 text-center">
            Built with Next.js · D3 · Supabase · Anthropic Claude
          </p>
        </div>

      </main>
    </div>
  )
}
