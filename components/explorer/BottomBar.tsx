'use client'

import { RotateCcw, ChevronRight } from 'lucide-react'
import { useSessionStore } from '@/store/useSessionStore'
import type { LogEntry } from '@/lib/types'

const ACTION_ICONS: Record<string, string> = {
  prune: '✂️',
  flag: '🚩',
  annotate: '✏️',
  expand: '🔍',
  reframe: '🔄',
  generate: '⚡',
  select: '👆',
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  onJumpToNode: (id: string) => void
}

export default function BottomBar({ onJumpToNode }: Props) {
  const { log, undoLastLog } = useSessionStore()

  return (
    <div className="h-full flex flex-col bg-slate-900 border-t border-slate-700/60">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/60">
        <span className="text-xs font-medium text-slate-400">Exploration Log</span>
        <button
          onClick={undoLastLog}
          disabled={log.length === 0}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 disabled:opacity-30 transition"
        >
          <RotateCcw className="w-3 h-3" /> Undo last
        </button>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex items-center gap-2 px-4 py-2 h-full min-w-max">
          {log.length === 0 ? (
            <span className="text-xs text-slate-600">No actions yet — click nodes to begin exploring.</span>
          ) : (
            log.map((entry: LogEntry, i) => (
              <button
                key={entry.id}
                onClick={() => onJumpToNode(entry.targetId)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 whitespace-nowrap transition"
              >
                <span>{ACTION_ICONS[entry.actionType] ?? '•'}</span>
                <span className="text-slate-500">{formatTime(entry.timestamp)}</span>
                <span>{entry.label ?? entry.actionType}</span>
                {entry.note && <span className="text-slate-500 max-w-28 truncate">— {entry.note}</span>}
                {i < log.length - 1 && <ChevronRight className="w-3 h-3 text-slate-600" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
