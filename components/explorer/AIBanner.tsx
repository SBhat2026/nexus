'use client'

import { X, AlertCircle } from 'lucide-react'

interface Props {
  reason: 'quota' | 'error' | null
  onDismiss: () => void
}

export default function AIBanner({ reason, onDismiss }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 text-xs">
      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
      <span className="flex-1">
        {reason === 'quota'
          ? 'Daily AI capacity reached. AI features paused — Cluster labeling, research directions, and Go Deeper are unavailable. Paper graph, toggles, and export work normally.'
          : 'AI features paused — Cluster labeling, research directions, and Go Deeper are unavailable. Paper graph, toggles, and export work normally.'}
      </span>
      <button
        onClick={onDismiss}
        className="shrink-0 p-0.5 hover:text-slate-700 dark:hover:text-slate-200 transition"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
