'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X, Star, Flag, Scissors, ExternalLink, BookOpen } from 'lucide-react'
import { useState } from 'react'
import { useSessionStore } from '@/store/useSessionStore'
import type { GraphNode, PaperNode, ClusterNode, DirectionNode, OutlierNode } from '@/lib/types'

interface Props {
  node: GraphNode | null
  onClose: () => void
  onPrune: (id: string, reason: string) => void
  onFlag: (id: string, note: string) => void
}

function StarRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onChange(n)}>
          <Star className={`w-4 h-4 transition ${(value ?? 0) >= n ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
        </button>
      ))}
    </div>
  )
}

function ScorePill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg bg-slate-800 border ${color}`}>
      <span className="text-lg font-bold text-slate-100">{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  )
}

function PaperDetail({ node }: { node: PaperNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-100 leading-snug">{node.title}</h3>
        <div className="text-xs text-slate-400 mt-1">{node.authors.join(', ')} · {node.year}</div>
      </div>
      {node.tldr && (
        <div className="text-xs text-slate-300 bg-slate-800 rounded-lg p-3 leading-relaxed">
          <span className="text-slate-500 font-medium">TLDR: </span>{node.tldr}
        </div>
      )}
      <div className="text-xs text-slate-400 leading-relaxed line-clamp-5">{node.abstract}</div>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <BookOpen className="w-3.5 h-3.5" />
        <span>{node.citationCount.toLocaleString()} citations</span>
      </div>
      {node.s2Url && (
        <a href={node.s2Url} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition">
          <ExternalLink className="w-3 h-3" /> View on Semantic Scholar
        </a>
      )}
    </div>
  )
}

function ClusterDetail({ node, onPrune }: { node: ClusterNode; onPrune: (id: string, reason: string) => void }) {
  const [pruneReason, setPruneReason] = useState('')
  const [showPruneInput, setShowPruneInput] = useState(false)

  function submitPrune() {
    if (!pruneReason.trim()) return
    onPrune(node.id, pruneReason)
    setShowPruneInput(false)
    setPruneReason('')
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">{node.label}</h3>
        <div className="text-xs text-slate-400 mt-1">{node.paperCount} papers</div>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{node.description}</p>
      {node.isPruned && node.pruneReason && (
        <div className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2 border border-red-800">
          Pruned: {node.pruneReason}
        </div>
      )}
      {!node.isPruned && (
        showPruneInput ? (
          <div className="space-y-2">
            <textarea
              value={pruneReason}
              onChange={(e) => setPruneReason(e.target.value)}
              placeholder="Why are you pruning this cluster?"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-red-500 resize-none"
              rows={3}
            />
            <div className="flex gap-2">
              <button onClick={submitPrune}
                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 text-xs rounded-lg transition flex items-center gap-1.5">
                <Scissors className="w-3 h-3" /> Prune
              </button>
              <button onClick={() => setShowPruneInput(false)}
                className="px-3 py-1.5 text-slate-400 text-xs hover:text-slate-200 transition">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowPruneInput(true)}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition">
            <Scissors className="w-3.5 h-3.5" /> Prune this cluster
          </button>
        )
      )}
    </div>
  )
}

function DirectionDetail({ node, onFlag }: { node: DirectionNode; onFlag: (id: string, note: string) => void }) {
  const addLog = useSessionStore((s) => s.addLog)
  const [rating, setRating] = useState<number | null>(node.humanRating)

  function handleRate(v: number) {
    setRating(v)
    addLog({ actionType: 'annotate', targetId: node.id, targetType: 'direction', note: `Rated ${v}/5` })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-100 leading-snug">{node.title}</h3>
      </div>
      <div className="flex gap-2">
        <ScorePill label="Novelty" value={node.noveltyScore} color="border-blue-500/30" />
        <ScorePill label="Feasibility" value={node.feasibilityScore} color="border-green-500/30" />
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{node.description}</p>
      {node.rationale && (
        <div className="text-xs text-slate-400 bg-slate-800 rounded-lg p-3 leading-relaxed">
          <span className="text-slate-500 font-medium">Rationale: </span>{node.rationale}
        </div>
      )}
      {node.suggestedNextSteps && node.suggestedNextSteps.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 font-medium mb-1">Suggested next steps</div>
          <ul className="space-y-1">
            {node.suggestedNextSteps.map((s, i) => (
              <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                <span className="text-slate-600 mt-0.5">›</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <div className="text-xs text-slate-500 mb-1">Your rating</div>
        <StarRating value={rating} onChange={handleRate} />
      </div>
      <button
        onClick={() => onFlag(node.id, 'Flagged for follow-up')}
        className={`flex items-center gap-1.5 text-xs transition ${node.isFlagged ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'}`}
      >
        <Flag className="w-3.5 h-3.5" /> {node.isFlagged ? 'Flagged' : 'Flag for follow-up'}
      </button>
    </div>
  )
}

function OutlierDetail({ node, onFlag }: { node: OutlierNode; onFlag: (id: string, note: string) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-100 leading-snug">{node.title}</h3>
        <div className="text-xs text-slate-400 mt-1">{node.authors.join(', ')} · {node.year}</div>
      </div>
      <div className="flex gap-3 text-xs text-slate-400 bg-slate-800 rounded-lg p-3">
        <div>
          <div className="text-orange-400 font-semibold text-base">{node.mahalanobisDistance.toFixed(1)}</div>
          <div>Mahalanobis dist.</div>
        </div>
      </div>
      {node.outlierExplanation && (
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="text-slate-500 font-medium">Why it&apos;s an outlier: </span>
          {node.outlierExplanation}
        </div>
      )}
      {node.bridgePotential && (
        <div className="text-xs text-slate-300 bg-amber-900/20 border border-amber-800/40 rounded-lg p-3 leading-relaxed">
          <span className="text-amber-500 font-medium">Bridge potential: </span>
          {node.bridgePotential}
        </div>
      )}
      <button
        onClick={() => onFlag(node.id, 'Outlier flagged for investigation')}
        className={`flex items-center gap-1.5 text-xs transition ${node.isFlagged ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'}`}
      >
        <Flag className="w-3.5 h-3.5" /> {node.isFlagged ? 'Flagged' : 'Flag for investigation'}
      </button>
    </div>
  )
}

export default function RightSidebar({ node, onClose, onPrune, onFlag }: Props) {
  return (
    <AnimatePresence>
      {node && (
        <motion.aside
          key="right-sidebar"
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="h-full bg-slate-900 border-l border-slate-700/60 overflow-y-auto flex flex-col"
        >
          <div className="flex items-center justify-between p-4 border-b border-slate-700/60">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              {node.nodeType.charAt(0).toUpperCase() + node.nodeType.slice(1)}
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 flex-1">
            {node.nodeType === 'paper' && <PaperDetail node={node as PaperNode} />}
            {node.nodeType === 'cluster' && <ClusterDetail node={node as ClusterNode} onPrune={onPrune} />}
            {node.nodeType === 'direction' && <DirectionDetail node={node as DirectionNode} onFlag={onFlag} />}
            {node.nodeType === 'outlier' && <OutlierDetail node={node as OutlierNode} onFlag={onFlag} />}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
