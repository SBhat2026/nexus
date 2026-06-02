'use client'
import { useCallback, useState } from 'react'
import type { GraphData } from '@/lib/types'

/**
 * In-memory undo/redo of graph + curation state for the session canvas. Fast and
 * session-scoped (cleared on reload, like any editor's undo stack). Durable history
 * lives in server snapshots; this is the lightweight Cmd-Z layer on top.
 *
 * `applyState` is responsible for reconciling the restored curation to the DB so a
 * later cold reload matches.
 */
export interface GraphHistoryState {
  graph: GraphData
  pruned: string[]
  pruneReasons: [string, string][]
  flagged: string[]
}

const CAP = 50

export function useGraphHistory(opts: {
  getCurrent: () => GraphHistoryState | null
  applyState: (s: GraphHistoryState) => void
}) {
  const [past, setPast] = useState<GraphHistoryState[]>([])
  const [future, setFuture] = useState<GraphHistoryState[]>([])

  const commit = useCallback(() => {
    const cur = opts.getCurrent()
    if (!cur) return
    setPast((p) => {
      const next = [...p, cur]
      return next.length > CAP ? next.slice(next.length - CAP) : next
    })
    setFuture([])
  }, [opts])

  const undo = useCallback(() => {
    if (past.length === 0) return
    const cur = opts.getCurrent()
    const s = past[past.length - 1]
    setPast((p) => p.slice(0, -1))
    if (cur) setFuture((f) => [...f, cur])
    opts.applyState(s)
  }, [past, opts])

  const redo = useCallback(() => {
    if (future.length === 0) return
    const cur = opts.getCurrent()
    const s = future[future.length - 1]
    setFuture((f) => f.slice(0, -1))
    if (cur) setPast((p) => [...p, cur])
    opts.applyState(s)
  }, [future, opts])

  return {
    commit,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  }
}
