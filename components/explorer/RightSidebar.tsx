'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X, Flag, Scissors, ExternalLink, BookOpen, Zap, Loader2, Focus, BookMarked, Building2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useSessionStore } from '@/store/useSessionStore'
import type { GraphNode, PaperNode, ClusterNode, DirectionNode, OutlierNode, GraphEdge } from '@/lib/types'
import NotesPanel from '@/components/explorer/NotesPanel'

interface Props {
  node: GraphNode | null
  onClose: () => void
  onPrune: (id: string, reason: string) => void
  onUnprune: (id: string) => void
  onFlag: (id: string, note: string) => void
  onDirectionsGenerated?: (directions: DirectionNode[], edges: GraphEdge[]) => void
  onAiUnavailable?: (reason: 'quota' | 'error') => void
  sessionId?: string
  prunedClusters?: { id: string; label: string; reason: string }[]
  aiAvailable?: boolean
  allNodes?: GraphNode[]
  onFindSimilar?: () => void
  findingSimilar?: boolean
  isLoggedIn?: boolean
}


function ScorePill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border ${color}`}>
      <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{value}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  )
}

function PaperDetail({
  node,
  onFindSimilar,
  findingSimilar = false,
}: {
  node: PaperNode
  onFindSimilar?: () => void
  findingSimilar?: boolean
}) {
  const { readPaperIds, toggleRead, paperFilters, toggleAuthorFilter, toggleVenueFilter } = useSessionStore()
  const isRead = readPaperIds.has(node.id)
  const [abstractOpen, setAbstractOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{node.title}</h3>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-1">
          {node.authors.map((a, i) => (
            <span key={i}>
              <button
                onClick={() => toggleAuthorFilter(a)}
                className={`hover:underline transition ${paperFilters.authors.has(a) ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400'}`}
                title={paperFilters.authors.has(a) ? 'Click to remove author filter' : 'Click to filter by author'}
              >
                {a}
              </button>
              {i < node.authors.length - 1 && <span className="text-slate-300 dark:text-slate-600">,</span>}
            </span>
          ))}
          <span className="text-slate-400 dark:text-slate-500">· {node.year}</span>
        </div>
        {node.venue && (
          <button
            onClick={() => toggleVenueFilter(node.venue!)}
            className={`mt-0.5 flex items-center gap-1 text-xs transition ${
              paperFilters.venues.has(node.venue)
                ? 'text-blue-600 dark:text-blue-400 font-medium'
                : 'text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
            title={paperFilters.venues.has(node.venue) ? 'Click to remove venue filter' : 'Click to filter by venue'}
          >
            <Building2 className="w-3 h-3 shrink-0" />
            {node.venue}
          </button>
        )}
      </div>
      <button
        onClick={() => toggleRead(node.id)}
        className={`flex items-center gap-1.5 text-xs font-medium transition ${
          isRead
            ? 'text-emerald-600 dark:text-emerald-400 hover:text-slate-500 dark:hover:text-slate-400'
            : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
        }`}
      >
        <BookMarked className="w-3.5 h-3.5" />
        {isRead ? 'Read — click to unmark' : 'Mark as read'}
      </button>
      {node.tldr && (
        <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 leading-relaxed">
          <span className="text-slate-400 dark:text-slate-500 font-medium">TLDR: </span>{node.tldr}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {node.abstract && (
          <button
            onClick={() => setAbstractOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <BookOpen className="w-3 h-3" />
            {abstractOpen ? 'Hide abstract' : 'View abstract'}
          </button>
        )}
        {onFindSimilar && (
          <button
            onClick={onFindSimilar}
            disabled={findingSimilar}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition"
          >
            {findingSimilar
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Finding…</>
              : <><Zap className="w-3 h-3" /> Find similar papers</>}
          </button>
        )}
      </div>

      {abstractOpen && node.abstract && (
        <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{node.abstract}</div>
      )}

      <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
        <BookOpen className="w-3.5 h-3.5" />
        <span>{node.citationCount.toLocaleString()} citations</span>
      </div>
      {node.s2Url && (
        <a href={node.s2Url} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition">
          <ExternalLink className="w-3 h-3" /> View on OpenAlex
        </a>
      )}
    </div>
  )
}

function ClusterDetail({
  node,
  onPrune,
  onUnprune,
  onDirectionsGenerated,
  onAiUnavailable,
  sessionId,
  prunedClusters = [],
  aiAvailable = true,
  hasByokKey = false,
  allNodes,
}: {
  node: ClusterNode
  onPrune: (id: string, reason: string) => void
  onUnprune: (id: string) => void
  onDirectionsGenerated?: (directions: DirectionNode[], edges: GraphEdge[]) => void
  onAiUnavailable?: (reason: 'quota' | 'error') => void
  sessionId?: string
  prunedClusters?: { id: string; label: string; reason: string }[]
  aiAvailable?: boolean
  hasByokKey?: boolean
  allNodes?: GraphNode[]
}) {
  const [pruneReason, setPruneReason] = useState('')
  const [showPruneInput, setShowPruneInput] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const { focusedClusterId, setFocusedCluster } = useSessionStore()
  const isFocused = focusedClusterId === node.id

  async function handleGenerateDirections() {
    if (!sessionId || generating) return
    setGenerating(true)
    setGenError(null)
    try {
      const byokKey = typeof window !== 'undefined' ? sessionStorage.getItem('nexus_anthropic_key') : null
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (byokKey) headers['x-anthropic-key'] = byokKey

      // Build cluster context from in-memory graph so directions work even when DB rows are missing
      const repPapers = allNodes
        ? (allNodes as PaperNode[]).filter(
            (n) => n.nodeType === 'paper' && (n as PaperNode).clusterId === node.id && (n as PaperNode).isRepresentative
          )
        : []
      const fallbackPapers = repPapers.length === 0 && allNodes
        ? (allNodes as PaperNode[]).filter(
            (n) => n.nodeType === 'paper' && (n as PaperNode).clusterId === node.id
          ).slice(0, 3)
        : repPapers
      const clusterContexts = [{
        clusterId: node.id,
        label: node.label,
        description: node.description ?? '',
        paperCount: node.paperCount,
        papers: fallbackPapers.slice(0, 3).map((p) => ({
          title: p.title,
          abstract: p.abstract ?? '',
          year: p.year,
          citationCount: p.citationCount,
        })),
      }]

      const res = await fetch('/api/directions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId, clusterIds: [node.id], prunedClusters, clusterContexts }),
      })
      const data = await res.json()
      if (!res.ok) { setGenError(data.error ?? 'Generation failed'); return }
      if (data.ai_available === false) {
        const msg = data.reason === 'quota'
          ? 'AI at capacity — add your Claude key in the sidebar to continue'
          : 'Direction generation unavailable — add GROQ_API_KEY or your Claude key'
        setGenError(msg)
        onAiUnavailable?.(data.reason ?? 'error')
        return
      }
      onDirectionsGenerated?.(data.directions, data.edges)
    } catch {
      setGenError('Request failed')
    } finally {
      setGenerating(false)
    }
  }

  function submitPrune() {
    if (!pruneReason.trim()) return
    onPrune(node.id, pruneReason)
    setShowPruneInput(false)
    setPruneReason('')
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{node.label}</h3>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {node.paperCount} papers
          {node.medianYear ? ` · median ${node.medianYear}` : ''}
        </div>
        {node.medianYear && node.medianYear < new Date().getFullYear() - 3 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 italic mt-0.5">This cluster may reflect older work.</p>
        )}
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{node.description}</p>

      {/* Focus mode toggle */}
      <button
        onClick={() => setFocusedCluster(isFocused ? null : node.id)}
        className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition border ${
          isFocused
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'
            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
        }`}
      >
        <Focus className="w-3.5 h-3.5" />
        {isFocused ? 'Exit focus mode' : 'Focus on this cluster'}
      </button>

      {/* Generate directions — primary action */}
      <button
        onClick={handleGenerateDirections}
        disabled={generating || !sessionId || (!aiAvailable && !hasByokKey)}
        title={(!aiAvailable && !hasByokKey) ? 'Requires AI — add your Claude key in the sidebar or wait for service to resume' : undefined}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 dark:disabled:bg-slate-700/50 text-white disabled:text-slate-400 dark:disabled:text-slate-500 font-semibold text-sm transition shadow-sm disabled:cursor-not-allowed disabled:shadow-none"
      >
        {generating
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Zap className="w-4 h-4" />}
        {generating ? 'Generating directions…' : 'Generate research directions'}
      </button>
      {genError && <div className="text-xs text-red-500 dark:text-red-400 -mt-2">{genError}</div>}

      {node.isPruned && (
        <div className="space-y-2">
          {node.pruneReason && (
            <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 border border-red-200 dark:border-red-800">
              Pruned: {node.pruneReason}
            </div>
          )}
          <button
            onClick={() => onUnprune(node.id)}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
          >
            <Scissors className="w-3 h-3" /> Restore cluster
          </button>
        </div>
      )}
      {!node.isPruned && (
        showPruneInput ? (
          <div className="space-y-2">
            <textarea
              value={pruneReason}
              onChange={(e) => setPruneReason(e.target.value)}
              placeholder="Why are you pruning this cluster?"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-red-400 dark:focus:border-red-500 resize-none"
              rows={3}
            />
            <div className="flex gap-2">
              <button onClick={submitPrune}
                className="px-3 py-1.5 bg-red-50 dark:bg-red-600/20 hover:bg-red-100 dark:hover:bg-red-600/30 border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-300 text-xs rounded-lg transition flex items-center gap-1.5">
                <Scissors className="w-3 h-3" /> Prune
              </button>
              <button onClick={() => setShowPruneInput(false)}
                className="px-3 py-1.5 text-slate-400 dark:text-slate-400 text-xs hover:text-slate-700 dark:hover:text-slate-200 transition">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowPruneInput(true)}
            className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition">
            <Scissors className="w-3.5 h-3.5" /> Prune this cluster
          </button>
        )
      )}
    </div>
  )
}

type VerifyResult = {
  coverageLabel: 'Low' | 'Medium' | 'High'
  closestPapers: { title: string; year: number | null; citationCount: number; url: string | null }[]
}

function DirectionDetail({ node, onFlag }: { node: DirectionNode; onFlag: (id: string, note: string) => void }) {
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  async function handleVerify() {
    if (verifying) return
    setVerifying(true)
    setVerifyError(null)
    try {
      const res = await fetch(`/api/directions/${node.id}/verify`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) { setVerifyError(data.error ?? 'Verification failed'); return }
      setVerifyResult(data)
    } catch {
      setVerifyError('Request failed')
    } finally {
      setVerifying(false)
    }
  }

  const coverageColor = verifyResult?.coverageLabel === 'Low'
    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/50'
    : verifyResult?.coverageLabel === 'Medium'
    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700/50'
    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700/50'

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{node.title}</h3>
      </div>
      <div className="flex gap-2 flex-wrap">
        <ScorePill label="AI estimate" value={node.noveltyScore} color="border-blue-200 dark:border-blue-500/30" />
        <ScorePill label="Feasibility" value={node.feasibilityScore} color="border-green-200 dark:border-green-500/30" />
        {verifyResult && (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${coverageColor}`}>
            Coverage: {verifyResult.coverageLabel}
          </span>
        )}
      </div>
      {!verifyResult && (
        <button
          onClick={handleVerify}
          disabled={verifying}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium transition disabled:opacity-50"
        >
          {verifying ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying…</> : 'Verify novelty'}
        </button>
      )}
      {verifyError && <p className="text-xs text-red-500 dark:text-red-400">{verifyError}</p>}
      {verifyResult?.closestPapers && verifyResult.closestPapers.length > 0 && (
        <div>
          <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-1.5">Closest existing work</div>
          <div className="space-y-2">
            {verifyResult.closestPapers.map((p, i) => (
              <div key={i} className="text-xs bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
                <p className="text-slate-700 dark:text-slate-300 leading-snug mb-0.5">{p.title}</p>
                <p className="text-slate-400 dark:text-slate-500">{p.year ?? '—'} · {p.citationCount.toLocaleString()} citations</p>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 mt-1 text-blue-600 dark:text-blue-400 hover:text-blue-500">
                    <ExternalLink className="w-2.5 h-2.5" /> View paper
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{node.description}</p>
      {node.rationale && (
        <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 leading-relaxed">
          <span className="text-slate-400 dark:text-slate-500 font-medium">Rationale: </span>{node.rationale}
        </div>
      )}
      {node.suggestedNextSteps && node.suggestedNextSteps.length > 0 && (
        <div>
          <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-1">Suggested next steps</div>
          <ul className="space-y-1">
            {node.suggestedNextSteps.map((s, i) => (
              <li key={i} className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                <span className="text-slate-300 dark:text-slate-600 mt-0.5">›</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        onClick={() => onFlag(node.id, 'Flagged for follow-up')}
        className={`flex items-center gap-1.5 text-xs transition ${node.isFlagged ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
      >
        <Flag className="w-3.5 h-3.5" /> {node.isFlagged ? 'Flagged' : 'Flag for follow-up'}
      </button>
    </div>
  )
}

function OutlierDetail({
  node,
  onFlag,
  onDirectionsGenerated,
  onAiUnavailable,
  sessionId,
  aiAvailable = true,
  hasByokKey = false,
  allNodes = [],
}: {
  node: OutlierNode
  onFlag: (id: string, note: string) => void
  onDirectionsGenerated?: (directions: DirectionNode[], edges: GraphEdge[]) => void
  onAiUnavailable?: (reason: 'quota' | 'error') => void
  sessionId?: string
  aiAvailable?: boolean
  hasByokKey?: boolean
  allNodes?: GraphNode[]
}) {
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const nearestCluster = allNodes.find((n) => n.id === node.nearestClusterId) as ClusterNode | undefined
  const computedExplanation = node.outlierExplanation
    ?? (nearestCluster
      ? `Nearest cluster is "${nearestCluster.label}", but this paper's embedding is too distant to be assigned — it may represent a distinct research angle.`
      : 'This paper is semantically distant from all clusters — it may represent an entirely different research direction.')

  async function handleGenerateDirections() {
    if (!sessionId || generating) return
    setGenerating(true)
    setGenError(null)
    try {
      const byokKey = typeof window !== 'undefined' ? sessionStorage.getItem('nexus_anthropic_key') : null
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (byokKey) headers['x-anthropic-key'] = byokKey
      const res = await fetch('/api/directions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId,
          outlierId: node.id,
          outlierFlagNote: node.isFlagged ? 'Flagged for investigation' : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setGenError(data.error ?? 'Generation failed'); return }
      if (data.ai_available === false) {
        const msg = data.reason === 'quota'
          ? 'AI at capacity — add your Claude key in the sidebar to continue'
          : 'Direction generation unavailable — add GROQ_API_KEY or your Claude key'
        setGenError(msg)
        onAiUnavailable?.(data.reason ?? 'error')
        return
      }
      onDirectionsGenerated?.(data.directions, data.edges)
    } catch {
      setGenError('Request failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{node.title}</h3>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{node.authors.join(', ')} · {node.year}</div>
      </div>
      <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
        <div>
          <div className="text-orange-500 dark:text-orange-400 font-semibold text-base">{node.mahalanobisDistance.toFixed(1)}</div>
          <div>Mahalanobis dist.</div>
        </div>
      </div>
      <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        <span className="text-slate-400 dark:text-slate-500 font-medium">Why it&apos;s an outlier: </span>
        {computedExplanation}
      </div>
      {node.bridgePotential && (
        <div className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg p-3 leading-relaxed">
          <span className="text-amber-600 dark:text-amber-500 font-medium">Bridge potential: </span>
          {node.bridgePotential}
        </div>
      )}
      <button
        onClick={handleGenerateDirections}
        disabled={generating || !sessionId || (!aiAvailable && !hasByokKey)}
        title={(!aiAvailable && !hasByokKey) ? 'Requires AI — add your Claude key in the sidebar or wait for service to resume' : undefined}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 dark:disabled:bg-slate-700/50 text-white disabled:text-slate-400 dark:disabled:text-slate-500 font-semibold text-sm transition shadow-sm disabled:cursor-not-allowed disabled:shadow-none"
      >
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {generating ? 'Generating…' : 'Generate directions from outlier'}
      </button>
      {genError && <div className="text-xs text-red-500 dark:text-red-400">{genError}</div>}

      <button
        onClick={() => onFlag(node.id, 'Outlier flagged for investigation')}
        className={`flex items-center gap-1.5 text-xs transition ${node.isFlagged ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
      >
        <Flag className="w-3.5 h-3.5" /> {node.isFlagged ? 'Flagged' : 'Flag for investigation'}
      </button>
    </div>
  )
}

export default function RightSidebar({ node, onClose, onPrune, onUnprune, onFlag, onDirectionsGenerated, onAiUnavailable, sessionId, prunedClusters = [], aiAvailable = true, allNodes, onFindSimilar, findingSimilar = false, isLoggedIn = false }: Props) {
  const [hasByokKey, setHasByokKey] = useState(false)

  useEffect(() => {
    setHasByokKey(!!sessionStorage.getItem('nexus_anthropic_key'))
    function onByokChanged() {
      setHasByokKey(!!sessionStorage.getItem('nexus_anthropic_key'))
    }
    window.addEventListener('nexus:byok-changed', onByokChanged)
    return () => window.removeEventListener('nexus:byok-changed', onByokChanged)
  }, [])

  return (
    <AnimatePresence>
      {node && (
        <motion.aside
          key="right-sidebar"
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700/60 overflow-y-auto flex flex-col"
        >
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700/60">
            <div className="text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wide">
              {node.nodeType.charAt(0).toUpperCase() + node.nodeType.slice(1)}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 flex-1">
            {node.nodeType === 'paper' && <PaperDetail node={node as PaperNode} onFindSimilar={onFindSimilar} findingSimilar={findingSimilar} />}
            {node.nodeType === 'cluster' && <ClusterDetail node={node as ClusterNode} onPrune={onPrune} onUnprune={onUnprune} onDirectionsGenerated={onDirectionsGenerated} onAiUnavailable={onAiUnavailable} sessionId={sessionId} prunedClusters={prunedClusters} aiAvailable={aiAvailable} hasByokKey={hasByokKey} allNodes={allNodes} />}
            {node.nodeType === 'direction' && <DirectionDetail node={node as DirectionNode} onFlag={onFlag} />}
            {node.nodeType === 'outlier' && <OutlierDetail node={node as OutlierNode} onFlag={onFlag} onDirectionsGenerated={onDirectionsGenerated} onAiUnavailable={onAiUnavailable} sessionId={sessionId} aiAvailable={aiAvailable} hasByokKey={hasByokKey} allNodes={allNodes} />}
            {sessionId && (
              <NotesPanel sessionId={sessionId} selectedNode={node} isLoggedIn={isLoggedIn} />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
