'use client'

import { useState } from 'react'
import { X, Plus, Minus, Link2, Unlink, FlaskConical, Loader2, Check, Pencil, FolderInput } from 'lucide-react'
import type { GraphEditAction, GraphNode } from '@/lib/types'

interface Props {
  actions: GraphEditAction[]
  nodes: GraphNode[]
  applying: boolean
  onApply: (selected: GraphEditAction[]) => void
  onClose: () => void
}

const LOW_CONF = 0.5

function nodeLabel(nodes: GraphNode[], id: string): string {
  const n = nodes.find((x) => x.id === id)
  if (!n) return id.slice(0, 8) + '…'
  if (n.nodeType === 'cluster') return (n as { label: string }).label
  if (n.nodeType === 'paper' || n.nodeType === 'outlier' || n.nodeType === 'direction') {
    const t = (n as { title?: string }).title ?? id
    return t.length > 40 ? t.slice(0, 38) + '…' : t
  }
  return id.slice(0, 8) + '…'
}

function describe(a: GraphEditAction, nodes: GraphNode[]): { icon: React.ReactNode; title: string } {
  switch (a.type) {
    case 'add_node':
      return { icon: <Plus className="w-3.5 h-3.5 text-emerald-600" />, title: `Add ${a.nodeType === 'paper' ? 'paper' : 'cluster'} “${a.label}”` }
    case 'remove_node':
      return { icon: <Minus className="w-3.5 h-3.5 text-red-600" />, title: `Remove “${nodeLabel(nodes, a.targetId)}”` }
    case 'add_edge':
      return { icon: <Link2 className="w-3.5 h-3.5 text-blue-600" />, title: `Link “${nodeLabel(nodes, a.sourceId)}” ↔ “${nodeLabel(nodes, a.targetId)}”` }
    case 'remove_edge':
      return { icon: <Unlink className="w-3.5 h-3.5 text-amber-600" />, title: `Remove a link` }
    case 'rename_cluster':
      return { icon: <Pencil className="w-3.5 h-3.5 text-violet-600" />, title: `Rename “${nodeLabel(nodes, a.targetId)}” → “${a.newLabel}”` }
    case 'assign_paper':
      return {
        icon: <FolderInput className="w-3.5 h-3.5 text-sky-600" />,
        title: a.clusterId
          ? `Move “${nodeLabel(nodes, a.paperId)}” → “${nodeLabel(nodes, a.clusterId)}”`
          : `Detach “${nodeLabel(nodes, a.paperId)}” from its cluster`,
      }
  }
}

export default function GraphEditPreview({ actions, nodes, applying, onApply, onClose }: Props) {
  // Edit suggestions: user can toggle individual edits off before applying.
  const [enabled, setEnabled] = useState<boolean[]>(() => actions.map(() => true))

  const selected = actions.filter((_, i) => enabled[i])

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Review proposed changes</h2>
            <p className="text-[11px] text-slate-400">Nothing is applied until you approve.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {actions.map((a, i) => {
            const d = describe(a, nodes)
            const experimental = a.confidence < LOW_CONF
            const on = enabled[i]
            return (
              <button
                key={i}
                onClick={() => setEnabled((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                className={`w-full text-left flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition ${
                  on
                    ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
                    : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20 opacity-50'
                }`}
              >
                <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
                  {on && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    {d.icon}
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-100">{d.title}</span>
                  </span>
                  <span className="block mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{a.reason}</span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">confidence {(a.confidence * 100).toFixed(0)}%</span>
                    {experimental && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                        <FlaskConical className="w-2.5 h-2.5" /> experimental
                      </span>
                    )}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <footer className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] text-slate-400">{selected.length} of {actions.length} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              Cancel
            </button>
            <button
              onClick={() => onApply(selected)}
              disabled={applying || selected.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Apply {selected.length > 0 ? selected.length : ''}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
