'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, ChevronRight, Download, GitBranch, Info, Sun, Moon, Home, Flag, Key, Network, Loader2, Calendar, X, Filter } from 'lucide-react'
import { useSessionStore } from '@/store/useSessionStore'
import type { NodeType, GraphNode, ClusterNode, PaperNode } from '@/lib/types'

interface Props {
  onGoDeeper: () => void
  onExport: () => void
  flaggedItems: { id: string; title: string; nodeType: NodeType }[]
  onJumpToNode: (id: string) => void
  onApplyDateFilter?: (min: number, max: number) => void
  aiAvailable?: boolean
  allNodes?: GraphNode[]
  selectedNodeType?: string | null
  goingDeeper?: boolean
  reclustering?: boolean
  width?: number
}

export default function LeftSidebar({
  onGoDeeper,
  onExport,
  flaggedItems,
  onJumpToNode,
  onApplyDateFilter,
  aiAvailable = true,
  allNodes,
  selectedNodeType,
  goingDeeper = false,
  reclustering = false,
  width,
}: Props) {
  const {
    sessionName, setSessionName, seedTopic, isDark, toggleTheme,
    expandedClusters, toggleCluster, focusedClusterId, setFocusedCluster,
    paperFilters, hideRead, toggleAuthorFilter, toggleVenueFilter,
    setYearRangeFilter, clearPaperFilters, setHideRead,
  } = useSessionStore()
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(sessionName)
  const [flaggedOpen, setFlaggedOpen] = useState(false)
  const [byokOpen, setByokOpen] = useState(false)
  const [dateFilterOpen, setDateFilterOpen] = useState(false)
  const [paperFiltersOpen, setPaperFiltersOpen] = useState(false)
  const [localYearMin, setLocalYearMin] = useState('')
  const [localYearMax, setLocalYearMax] = useState('')
  const [minYear, setMinYear] = useState(String(new Date().getFullYear() - 6))
  const [maxYear, setMaxYear] = useState(String(new Date().getFullYear()))
  const [keyInput, setKeyInput] = useState('')
  const [savedKey, setSavedKey] = useState('')
  const [venueInput, setVenueInput] = useState('')

  const POPULAR_VENUES = [
    'Nature', 'Science', 'Cell', 'PNAS', 'eLife',
    'NeurIPS', 'ICML', 'ICLR', 'CVPR', 'ECCV',
    'ACL', 'EMNLP', 'NAACL', 'KDD', 'WWW',
    'arXiv', 'PLOS ONE', 'Bioinformatics',
  ]

  useEffect(() => {
    const k = sessionStorage.getItem('nexus_anthropic_key') ?? ''
    setSavedKey(k)
  }, [])

  function saveKey() {
    const trimmed = keyInput.trim()
    if (!trimmed.startsWith('sk-ant-')) return
    sessionStorage.setItem('nexus_anthropic_key', trimmed)
    setSavedKey(trimmed)
    setKeyInput('')
    window.dispatchEvent(new Event('nexus:byok-changed'))
  }

  function clearKey() {
    sessionStorage.removeItem('nexus_anthropic_key')
    setSavedKey('')
    window.dispatchEvent(new Event('nexus:byok-changed'))
  }

  function commitName() {
    setSessionName(nameValue || 'Untitled Session')
    setEditingName(false)
  }

  const clusters = useMemo(
    () => (allNodes ?? []).filter((n): n is ClusterNode => n.nodeType === 'cluster'),
    [allNodes]
  )

  // Group clusters by generation: 1 = initial, 2+ = Go Deeper rounds
  const clustersByGen = useMemo(() => {
    const map = new Map<number, ClusterNode[]>()
    clusters.forEach((c) => {
      const gen = c.generation ?? 1
      const arr = map.get(gen) ?? []
      arr.push(c)
      map.set(gen, arr)
    })
    // Return sorted by generation ascending
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [clusters])

  const papersByCluster = useMemo(() => {
    const map = new Map<string, PaperNode[]>()
    ;(allNodes ?? []).forEach((n) => {
      if (n.nodeType === 'paper') {
        const p = n as PaperNode
        if (p.clusterId) {
          const arr = map.get(p.clusterId) ?? []
          arr.push(p)
          map.set(p.clusterId, arr)
        }
      }
    })
    return map
  }, [allNodes])

  // Top authors by paper count
  const topAuthors = useMemo(() => {
    const counts = new Map<string, number>()
    ;(allNodes ?? []).forEach((n) => {
      if (n.nodeType === 'paper' || n.nodeType === 'outlier') {
        const p = n as PaperNode
        ;(p.authors ?? []).forEach((a) => counts.set(a, (counts.get(a) ?? 0) + 1))
      }
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name]) => name)
  }, [allNodes])

  // Top venues by paper count
  const topVenues = useMemo(() => {
    const counts = new Map<string, number>()
    ;(allNodes ?? []).forEach((n) => {
      if (n.nodeType === 'paper') {
        const p = n as PaperNode
        const venue = p.venue ?? '(no venue)'
        counts.set(venue, (counts.get(venue) ?? 0) + 1)
      }
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([venue]) => venue)
  }, [allNodes])

  // Active filter count for badge
  const activeFilterCount = paperFilters.authors.size + paperFilters.venues.size +
    (paperFilters.yearMin !== null || paperFilters.yearMax !== null ? 1 : 0) +
    (hideRead ? 1 : 0)

  const canGoDeeper = selectedNodeType === 'paper' || selectedNodeType === 'outlier'

  return (
    <aside
      className="h-full w-[260px] shrink-0 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/60 overflow-hidden"
      style={{ width: width ?? 260 }}
    >
      {/* Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2 shrink-0">
        <Link
          href="/"
          className="shrink-0 p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
          title="Home — start new topic"
        >
          <Home className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => { if (e.key === 'Enter') commitName() }}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-0.5 rounded text-sm border border-slate-300 dark:border-slate-600 outline-none"
            />
          ) : (
            <div
              className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition truncate"
              onClick={() => { setNameValue(sessionName); setEditingName(true) }}
              title="Click to rename"
            >
              {sessionName}
            </div>
          )}
          {seedTopic && (
            <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{seedTopic}</div>
          )}
        </div>
        <button
          onClick={toggleTheme}
          className="shrink-0 p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Focused cluster indicator */}
      {focusedClusterId && (
        <div className="shrink-0 border-b border-slate-200 dark:border-slate-700/60 px-3 py-2 flex items-center justify-between bg-blue-50 dark:bg-blue-900/10">
          <span className="text-xs text-blue-700 dark:text-blue-400 font-medium truncate flex-1 min-w-0">
            Focus: {clusters.find((c) => c.id === focusedClusterId)?.label ?? 'cluster'}
          </span>
          <button
            onClick={() => setFocusedCluster(null)}
            className="shrink-0 ml-2 p-0.5 rounded text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
            title="Exit focus mode"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Flagged items — only shown when there are flags */}
      {flaggedItems.length > 0 && (
        <div className="border-b border-slate-200 dark:border-slate-700/60 shrink-0">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition"
            onClick={() => setFlaggedOpen((v) => !v)}
          >
            <span className="flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5" />
              Flagged ({flaggedItems.length})
            </span>
            {flaggedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {flaggedOpen && (
            <div className="pb-2 px-2 space-y-0.5 max-h-40 overflow-y-auto">
              {flaggedItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onJumpToNode(item.id)}
                  className="w-full text-left px-2 py-1.5 rounded text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 truncate transition flex items-center gap-1.5"
                >
                  <span className="text-slate-300 dark:text-slate-600 shrink-0">›</span>
                  {item.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Date range filter */}
      {onApplyDateFilter && (
        <div className="border-b border-slate-200 dark:border-slate-700/60 shrink-0">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            onClick={() => setDateFilterOpen((v) => !v)}
          >
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Date filter</span>
            {dateFilterOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {dateFilterOpen && (
            <div className="px-3 pb-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minYear}
                  onChange={(e) => setMinYear(e.target.value)}
                  min={1900}
                  max={new Date().getFullYear()}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-400"
                  placeholder="From"
                />
                <span className="text-slate-400 text-xs shrink-0">–</span>
                <input
                  type="number"
                  value={maxYear}
                  onChange={(e) => setMaxYear(e.target.value)}
                  min={1900}
                  max={new Date().getFullYear()}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-400"
                  placeholder="To"
                />
              </div>
              <button
                onClick={() => {
                  const mn = parseInt(minYear), mx = parseInt(maxYear)
                  if (!isNaN(mn) && !isNaN(mx) && mn <= mx) onApplyDateFilter(mn, mx)
                }}
                disabled={reclustering}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 disabled:opacity-40 transition"
              >
                {reclustering ? <><Loader2 className="w-3 h-3 animate-spin" /> Re-clustering…</> : 'Apply & re-cluster'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Paper filters — author / venue / year */}
      {(allNodes?.length ?? 0) > 0 && (
        <div className="border-b border-slate-200 dark:border-slate-700/60 shrink-0">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            onClick={() => setPaperFiltersOpen((v) => !v)}
          >
            <span className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[9px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </span>
            {paperFiltersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {paperFiltersOpen && (
            <div className="px-3 pb-3 space-y-3">
              {/* Authors */}
              {topAuthors.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">Authors</div>
                  <div className="flex flex-wrap gap-1">
                    {topAuthors.map((a) => (
                      <button
                        key={a}
                        onClick={() => toggleAuthorFilter(a)}
                        className={`px-2 py-0.5 rounded-full text-[10px] border transition ${
                          paperFilters.authors.has(a)
                            ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-600'
                        }`}
                      >
                        {a.split(' ').slice(-1)[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Venues */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">Venues</div>
                {/* Manual input */}
                <div className="flex gap-1 mb-1.5">
                  <input
                    value={venueInput}
                    onChange={(e) => setVenueInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && venueInput.trim()) {
                        toggleVenueFilter(venueInput.trim())
                        setVenueInput('')
                      }
                    }}
                    placeholder="Type venue & press Enter…"
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[10px] text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400 placeholder-slate-300 dark:placeholder-slate-600"
                  />
                </div>
                {/* Active venue filters */}
                {paperFilters.venues.size > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {Array.from(paperFilters.venues).map((v) => (
                      <button
                        key={v}
                        onClick={() => toggleVenueFilter(v)}
                        className="px-2 py-0.5 rounded-full text-[10px] border bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300"
                      >
                        {v.length > 14 ? v.slice(0, 12) + '…' : v} ×
                      </button>
                    ))}
                  </div>
                )}
                {/* Popular suggestions */}
                <div className="text-[9px] text-slate-400 dark:text-slate-600 mb-1">Popular:</div>
                <div className="flex flex-wrap gap-1">
                  {POPULAR_VENUES.filter((v) => !paperFilters.venues.has(v)).slice(0, 10).map((v) => (
                    <button
                      key={v}
                      onClick={() => toggleVenueFilter(v)}
                      className="px-2 py-0.5 rounded-full text-[10px] border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition"
                    >
                      {v}
                    </button>
                  ))}
                  {topVenues.filter((v) => !POPULAR_VENUES.includes(v) && !paperFilters.venues.has(v)).slice(0, 4).map((v) => (
                    <button
                      key={v}
                      onClick={() => toggleVenueFilter(v)}
                      className="px-2 py-0.5 rounded-full text-[10px] border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition"
                    >
                      {v.length > 14 ? v.slice(0, 12) + '…' : v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Year range */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">Year range</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={localYearMin}
                    onChange={(e) => setLocalYearMin(e.target.value)}
                    onBlur={() => {
                      const v = localYearMin === '' ? null : parseInt(localYearMin)
                      setYearRangeFilter(isNaN(v as number) ? null : v, paperFilters.yearMax)
                    }}
                    placeholder="From"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-400"
                  />
                  <span className="text-slate-400 text-xs shrink-0">–</span>
                  <input
                    type="number"
                    value={localYearMax}
                    onChange={(e) => setLocalYearMax(e.target.value)}
                    onBlur={() => {
                      const v = localYearMax === '' ? null : parseInt(localYearMax)
                      setYearRangeFilter(paperFilters.yearMin, isNaN(v as number) ? null : v)
                    }}
                    placeholder="To"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Hide read */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideRead}
                  onChange={(e) => setHideRead(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 text-blue-500"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">Hide read papers</span>
              </label>

              {/* Clear */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { clearPaperFilters(); setLocalYearMin(''); setLocalYearMax('') }}
                  className="text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Clusters section */}
      <div className="flex-1 min-h-0 overflow-y-auto border-b border-slate-200 dark:border-slate-700/60">
        <div className="px-3 pt-3 pb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <Network className="w-3.5 h-3.5" />
          Clusters
          {clusters.length > 0 && (
            <span className="text-slate-400 dark:text-slate-500 font-normal">({clusters.length})</span>
          )}
        </div>
        {clusters.length === 0 ? (
          <div className="px-3 pb-3 text-xs text-slate-400 dark:text-slate-500 italic">No clusters loaded</div>
        ) : (
          <div className="px-2 pb-3 space-y-3">
            {clustersByGen.map(([gen, genClusters]) => (
              <div key={gen}>
                {/* Generation label */}
                <div className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[9px] font-bold leading-none">{gen}</span>
                  {gen === 1 ? 'Initial' : `Round ${gen}`}
                </div>
                <div className="space-y-0.5">
                  {genClusters.map((c) => {
                    const isExpanded = expandedClusters.has(c.id)
                    const clPapers = (papersByCluster.get(c.id) ?? [])
                      .sort((a, b) => b.citationCount - a.citationCount)
                    return (
                      <div key={c.id}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { onJumpToNode(c.id); toggleCluster(c.id) }}
                            className="shrink-0 p-0.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                            title={isExpanded ? 'Collapse' : 'Expand papers in graph'}
                          >
                            {isExpanded
                              ? <ChevronDown className="w-3.5 h-3.5" />
                              : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => onJumpToNode(c.id)}
                            className="flex-1 text-left py-1 truncate text-xs text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
                          >
                            <span className="font-medium">{c.label}</span>
                            <span className="text-slate-400 dark:text-slate-500 ml-1.5">{c.paperCount}</span>
                          </button>
                        </div>
                        {isExpanded && clPapers.length > 0 && (
                          <div className="ml-5 mt-0.5 space-y-px pb-1">
                            {clPapers.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => onJumpToNode(p.id)}
                                className="w-full text-left text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-0.5 leading-snug transition"
                                style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                              >
                                {p.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI model / BYOK */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-700/60 shrink-0">
        <button
          className="w-full flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition mb-1"
          onClick={() => setByokOpen((v) => !v)}
        >
          <span className="flex items-center gap-1.5"><Key className="w-3.5 h-3.5" /> AI Model</span>
          {byokOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <div className="text-xs text-slate-400 dark:text-slate-500">
          {savedKey ? `Claude Sonnet (key: …${savedKey.slice(-4)})` : 'Llama 3.3 (free)'}
        </div>
        {byokOpen && (
          <div className="mt-2 space-y-2">
            {savedKey ? (
              <button
                onClick={clearKey}
                className="w-full py-1.5 rounded-lg text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800/40 transition"
              >
                Clear Claude key
              </button>
            ) : (
              <>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveKey() }}
                  placeholder="sk-ant-…"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 font-mono"
                />
                <button
                  onClick={saveKey}
                  disabled={!keyInput.trim().startsWith('sk-ant-')}
                  className="w-full py-1.5 rounded-lg text-xs bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 disabled:opacity-40 transition"
                >
                  Use Claude (your key)
                </button>
                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                  Stored in this browser only — never sent to our servers except to make API calls.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 flex flex-col gap-2 shrink-0">
        <button
          onClick={onGoDeeper}
          disabled={!aiAvailable || goingDeeper}
          title={
            !aiAvailable
              ? 'Requires AI — currently unavailable'
              : goingDeeper
              ? 'Clustering new papers…'
              : !canGoDeeper
              ? 'Click a paper or outlier node in the graph first'
              : undefined
          }
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium transition disabled:bg-slate-50 disabled:dark:bg-slate-800/40 disabled:text-slate-300 disabled:dark:text-slate-600 disabled:border-slate-100 disabled:dark:border-slate-700/50 disabled:cursor-not-allowed"
        >
          {goingDeeper
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Clustering…</>
            : <><GitBranch className="w-3.5 h-3.5" /> Go Deeper</>}
        </button>
        <button
          onClick={onExport}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium transition"
        >
          <Download className="w-3.5 h-3.5" /> Export JSON
        </button>
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-700/60 shrink-0">
        <Link
          href="/about"
          className="flex items-center justify-between w-full group rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition font-medium">
            <Info className="w-3.5 h-3.5" /> How to use Nexus
          </span>
          <span className="text-[10px] text-slate-300 dark:text-slate-600 group-hover:text-blue-400 transition">Guide →</span>
        </Link>
      </div>
    </aside>
  )
}
