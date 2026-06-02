'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, GitBranch, Camera, Clock, RotateCcw, Plus, Loader2 } from 'lucide-react'

export interface SnapshotMeta {
  id: string
  version: number
  parent_version: number | null
  label: string | null
  origin: 'manual' | 'auto' | 'revert' | 'initial'
  node_count: number
  edge_count: number
  created_at: string
}

interface Props {
  sessionId: string
  open: boolean
  onClose: () => void
  onRevert: (version: number) => Promise<void>
  onCheckpoint: (label: string) => Promise<void>
}

const ORIGIN_BADGE: Record<SnapshotMeta['origin'], { label: string; cls: string }> = {
  manual: { label: 'checkpoint', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  auto: { label: 'auto', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400' },
  revert: { label: 'revert', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  initial: { label: 'initial', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function HistoryPanel({ sessionId, open, onClose, onRevert, onCheckpoint }: Props) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [busyVersion, setBusyVersion] = useState<number | null>(null)
  const [checkpointing, setCheckpointing] = useState(false)
  const [label, setLabel] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/session/${sessionId}/snapshots`)
      const data = await res.json()
      setSnapshots(data.snapshots ?? [])
    } catch {
      setSnapshots([])
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  async function handleCheckpoint() {
    if (checkpointing) return
    setCheckpointing(true)
    try {
      await onCheckpoint(label.trim() || 'Checkpoint')
      setLabel('')
      await refresh()
    } finally {
      setCheckpointing(false)
    }
  }

  async function handleRevert(version: number) {
    if (busyVersion != null) return
    setBusyVersion(version)
    try {
      await onRevert(version)
      await refresh()
    } finally {
      setBusyVersion(null)
    }
  }

  if (!open) return null

  return (
    <div className="absolute inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
      <aside
        className="relative h-full w-[360px] max-w-[90vw] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">History</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* New checkpoint */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCheckpoint() }}
            placeholder="Name a checkpoint…"
            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <button
            onClick={handleCheckpoint}
            disabled={checkpointing}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition"
          >
            {checkpointing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : snapshots.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 px-6 text-center text-slate-400">
              <Clock className="w-6 h-6" />
              <p className="text-xs">No checkpoints yet. Save one above, or they&apos;ll appear automatically before big changes.</p>
            </div>
          ) : (
            <ol className="relative px-4 py-3">
              <div className="absolute left-[26px] top-4 bottom-4 w-px bg-slate-200 dark:bg-slate-700" />
              {snapshots.map((s, i) => {
                const badge = ORIGIN_BADGE[s.origin]
                const isHead = i === 0
                return (
                  <li key={s.id} className="relative pl-8 pb-4 last:pb-0">
                    <span
                      className={`absolute left-1.5 top-1 w-3 h-3 rounded-full border-2 ${
                        isHead
                          ? 'bg-blue-500 border-blue-200 dark:border-blue-900'
                          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                      }`}
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">
                            {s.label || `Version ${s.version}`}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.cls}`}>{badge.label}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400 flex items-center gap-2">
                          <span>v{s.version}</span>
                          {s.parent_version != null && (
                            <span className="flex items-center gap-0.5"><GitBranch className="w-2.5 h-2.5" />from v{s.parent_version}</span>
                          )}
                          <span>{s.node_count} nodes</span>
                          <span>{relativeTime(s.created_at)}</span>
                        </div>
                      </div>
                      {!isHead && (
                        <button
                          onClick={() => handleRevert(s.version)}
                          disabled={busyVersion != null}
                          title={`Revert to v${s.version}`}
                          className="shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition"
                        >
                          {busyVersion === s.version ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                          Revert
                        </button>
                      )}
                      {isHead && (
                        <span className="shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                          <Plus className="w-3 h-3" />current
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </aside>
    </div>
  )
}
