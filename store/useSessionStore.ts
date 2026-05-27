'use client'

import { create } from 'zustand'
import type { LayerToggles, LogEntry, NodeType } from '@/lib/types'

interface SessionState {
  sessionId: string | null
  seedTopic: string
  sessionName: string
  selectedNodeId: string | null
  depth: number
  layerToggles: LayerToggles
  log: LogEntry[]
  focusNodeId: string | null
  expandedClusters: Set<string>
  readPaperIds: Set<string>
  isDark: boolean
  dateFilter: { min: number; max: number } | null
  focusedClusterId: string | null
}

interface SessionActions {
  setSession: (id: string, topic: string) => void
  setSessionName: (name: string) => void
  selectNode: (id: string | null) => void
  setDepth: (d: number) => void
  toggleLayer: (key: keyof LayerToggles) => void
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void
  undoLastLog: () => void
  setFocusNode: (id: string | null) => void
  toggleCluster: (id: string) => void
  toggleRead: (id: string) => void
  toggleTheme: () => void
  setDateFilter: (range: { min: number; max: number } | null) => void
  setFocusedCluster: (id: string | null) => void
}

export const useSessionStore = create<SessionState & SessionActions>((set, get) => ({
  sessionId: null,
  seedTopic: '',
  sessionName: 'Untitled Session',
  selectedNodeId: null,
  depth: 2,
  focusNodeId: null,
  expandedClusters: new Set<string>(),
  readPaperIds: new Set<string>(),
  isDark: false,
  dateFilter: null,
  focusedClusterId: null,
  layerToggles: {
    papers: true,
    directions: true,
    outliers: true,
    pruned: false,
    citationEdges: true,
    semanticEdges: true,
    generatedEdges: true,
  },
  log: [],

  setSession: (id, topic) =>
    set({ sessionId: id, seedTopic: topic, sessionName: topic || 'Untitled Session' }),

  setSessionName: (name) => set({ sessionName: name }),

  selectNode: (id) => set({ selectedNodeId: id }),

  setDepth: (d) => set({ depth: d }),

  toggleLayer: (key) =>
    set((s) => ({
      layerToggles: { ...s.layerToggles, [key]: !s.layerToggles[key] },
    })),

  addLog: (entry) => {
    const newEntry: LogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    set((s) => ({ log: [...s.log, newEntry] }))
  },

  undoLastLog: () =>
    set((s) => ({ log: s.log.slice(0, -1) })),

  setFocusNode: (id) => set({ focusNodeId: id }),

  toggleTheme: () => set((s) => ({ isDark: !s.isDark })),

  toggleCluster: (id) => set((s) => {
    const next = new Set(s.expandedClusters)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { expandedClusters: next }
  }),

  toggleRead: (id) => set((s) => {
    const next = new Set(s.readPaperIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { readPaperIds: next }
  }),

  setDateFilter: (range) => set({ dateFilter: range }),

  setFocusedCluster: (id) => set({ focusedClusterId: id }),
}))
