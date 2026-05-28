'use client'

import { create } from 'zustand'
import type { LayerToggles, LogEntry, NodeType } from '@/lib/types'

export interface PaperFilters {
  authors: Set<string>
  venues: Set<string>
  yearMin: number | null
  yearMax: number | null
}

interface SessionState {
  sessionId: string | null
  seedTopic: string
  sessionName: string
  sourceProvider: 'openalex' | 'core' | null
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
  paperFilters: PaperFilters
  hideRead: boolean
}

interface SessionActions {
  setSession: (id: string, topic: string) => void
  setSessionName: (name: string) => void
  setSourceProvider: (p: 'openalex' | 'core' | null) => void
  selectNode: (id: string | null) => void
  setDepth: (d: number) => void
  toggleLayer: (key: keyof LayerToggles) => void
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void
  undoLastLog: () => void
  setFocusNode: (id: string | null) => void
  toggleCluster: (id: string) => void
  toggleRead: (id: string) => void
  setReadPaperIds: (ids: string[]) => void
  toggleTheme: () => void
  setDateFilter: (range: { min: number; max: number } | null) => void
  setFocusedCluster: (id: string | null) => void
  toggleAuthorFilter: (name: string) => void
  toggleVenueFilter: (venue: string) => void
  setYearRangeFilter: (min: number | null, max: number | null) => void
  clearPaperFilters: () => void
  setHideRead: (b: boolean) => void
}

const EMPTY_PAPER_FILTERS: PaperFilters = {
  authors: new Set<string>(),
  venues: new Set<string>(),
  yearMin: null,
  yearMax: null,
}

export const useSessionStore = create<SessionState & SessionActions>((set, get) => ({
  sessionId: null,
  seedTopic: '',
  sessionName: 'Untitled Session',
  sourceProvider: null,
  selectedNodeId: null,
  depth: 2,
  focusNodeId: null,
  expandedClusters: new Set<string>(),
  readPaperIds: new Set<string>(),
  isDark: false,
  dateFilter: null,
  focusedClusterId: null,
  paperFilters: EMPTY_PAPER_FILTERS,
  hideRead: false,
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

  setSourceProvider: (p) => set({ sourceProvider: p }),

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

  toggleRead: (id) => {
    const { readPaperIds, sessionId } = get()
    const wasRead = readPaperIds.has(id)
    // Optimistic update
    set((s) => {
      const next = new Set(s.readPaperIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { readPaperIds: next }
    })
    // Persist to DB
    if (sessionId) {
      fetch(`/api/papers/${id}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, isRead: !wasRead }),
      }).then((r) => {
        if (!r.ok) {
          // Rollback on failure
          set((s) => {
            const next = new Set(s.readPaperIds)
            if (wasRead) next.add(id)
            else next.delete(id)
            return { readPaperIds: next }
          })
        }
      }).catch(() => {
        set((s) => {
          const next = new Set(s.readPaperIds)
          if (wasRead) next.add(id)
          else next.delete(id)
          return { readPaperIds: next }
        })
      })
    }
  },

  setReadPaperIds: (ids) => set({ readPaperIds: new Set(ids) }),

  setDateFilter: (range) => set({ dateFilter: range }),

  setFocusedCluster: (id) => set({ focusedClusterId: id }),

  toggleAuthorFilter: (name) => set((s) => {
    const next = new Set(s.paperFilters.authors)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    return { paperFilters: { ...s.paperFilters, authors: next } }
  }),

  toggleVenueFilter: (venue) => set((s) => {
    const next = new Set(s.paperFilters.venues)
    if (next.has(venue)) next.delete(venue)
    else next.add(venue)
    return { paperFilters: { ...s.paperFilters, venues: next } }
  }),

  setYearRangeFilter: (min, max) => set((s) => ({
    paperFilters: { ...s.paperFilters, yearMin: min, yearMax: max },
  })),

  clearPaperFilters: () => set({ paperFilters: EMPTY_PAPER_FILTERS }),

  setHideRead: (b) => set({ hideRead: b }),
}))
