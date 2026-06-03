'use client'

import { useEffect, useRef, useState, use, useMemo, useCallback } from 'react'
import { useSessionStore } from '@/store/useSessionStore'
import type { GraphData, GraphNode, NodeType, DirectionNode, GraphEdge } from '@/lib/types'
import GraphCanvas, { GraphCanvasHandle } from '@/components/explorer/GraphCanvas'
import LeftSidebar from '@/components/explorer/LeftSidebar'
import RightSidebar from '@/components/explorer/RightSidebar'
import AIBanner from '@/components/explorer/AIBanner'
import LoadingState from '@/components/explorer/LoadingState'
import ErrorState from '@/components/explorer/ErrorState'
import ChatBar from '@/components/explorer/ChatBar'
import AuthButton from '@/components/AuthButton'
import SignInModal from '@/components/SignInModal'
import { createClient } from '@/lib/supabase/client'
import { useSessionHeartbeat } from '@/hooks/useSessionHeartbeat'
import { useGraphHistory, type GraphHistoryState } from '@/hooks/useGraphHistory'
import HistoryPanel from '@/components/explorer/HistoryPanel'
import SessionProgress from '@/components/landing/SessionProgress'
import Breadcrumb from '@/components/explorer/Breadcrumb'
import { useRouter } from 'next/navigation'
import { Undo2, Redo2, History as HistoryIcon } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

type LoadStatus = 'loading' | 'ready' | 'error'

export default function SessionPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { setSession, selectNode, selectedNodeId, layerToggles, isDark, focusedClusterId, setFocusedCluster, setReadPaperIds, setSourceProvider, setSourceIntelligence } = useSessionStore()

  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [seedTopic, setSeedTopic] = useState('')
  const [pruned, setPruned] = useState<Set<string>>(new Set())
  const [prunedReasons, setPrunedReasons] = useState<Map<string, string>>(new Map())
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [aiAvailable, setAiAvailable] = useState(true)
  const [aiReason, setAiReason] = useState<'quota' | 'error' | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [goingDeeper, setGoingDeeper] = useState(false)
  const [drilling, setDrilling] = useState(false)
  const [drillProgress, setDrillProgress] = useState<{ sessionId: string; topic: string } | null>(null)
  const [reclustering, setReclustering] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'info' | 'error'; text: string } | null>(null)

  const [leftWidth, setLeftWidth] = useState(260)
  const [rightWidth, setRightWidth] = useState(340)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [showGoDeepGate, setShowGoDeepGate] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const startLeftResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = leftWidth
    function onMove(ev: PointerEvent) {
      const delta = ev.clientX - startX
      setLeftWidth(Math.min(400, Math.max(180, startWidth + delta)))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [leftWidth])

  const startRightResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = rightWidth
    function onMove(ev: PointerEvent) {
      const delta = startX - ev.clientX
      setRightWidth(Math.min(480, Math.max(240, startWidth + delta)))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [rightWidth])

  const canvasRef = useRef<GraphCanvasHandle>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setIsLoggedIn(!!data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session?.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSave() {
    if (isSaved || saving) return
    if (!isLoggedIn) {
      setShowSignInModal(true)
      return
    }
    setSaving(true)
    try {
      await fetch(`/api/session/${id}/save`, { method: 'PATCH' })
      setIsSaved(true)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`nexus_saved_${id}`, '1')
      }
    } finally {
      setSaving(false)
    }
  }

  useSessionHeartbeat(id)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setLoadError(null)

    // Rehydrate curation state from cached node flags (cache-hit path).
    function seedCurationFromGraph(g: GraphData) {
      const pset = new Set<string>()
      const preasons = new Map<string, string>()
      const fset = new Set<string>()
      for (const n of g.nodes) {
        if (n.nodeType === 'cluster' && (n as { isPruned?: boolean }).isPruned) {
          pset.add(n.id)
          const r = (n as { pruneReason?: string }).pruneReason
          if (r) preasons.set(n.id, r)
        }
        if ((n as { isFlagged?: boolean }).isFlagged) fset.add(n.id)
      }
      setPruned(pset)
      setPrunedReasons(preasons)
      setFlagged(fset)
    }

    // Rehydrate from the authoritative DB arrays (API path).
    function seedCurationFromArrays(prunedIds: string[], reasons: Record<string, string>, flaggedIds: string[]) {
      setPruned(new Set(prunedIds))
      setPrunedReasons(new Map(Object.entries(reasons)))
      setFlagged(new Set(flaggedIds))
    }

    async function load() {
      const topic = typeof window !== 'undefined'
        ? sessionStorage.getItem(`nexus_seed_${id}`) ?? ''
        : ''

      // Parse cache once; use as fallback if API fails
      let cachedGraph: GraphData | null = null
      if (typeof window !== 'undefined') {
        const raw = sessionStorage.getItem(`nexus_graph_${id}`)
        if (raw) { try { cachedGraph = JSON.parse(raw) } catch {} }
      }

      const cachedSource = sessionStorage.getItem(`nexus_source_${id}`) as 'openalex' | 'core' | null
      if (cachedSource) setSourceProvider(cachedSource)

      const cachedSI = sessionStorage.getItem(`nexus_si_${id}`)
      if (cachedSI) { try { setSourceIntelligence(JSON.parse(cachedSI)) } catch {} }

      if (sessionStorage.getItem(`nexus_saved_${id}`)) setIsSaved(true)

      // Use cache immediately if labels are already fresh (non-generic)
      if (cachedGraph) {
        const hasGenericLabels = cachedGraph.nodes.some(
          (n: { nodeType: string; label?: string }) =>
            n.nodeType === 'cluster' && /^Cluster [A-Z] \(\d+\)$/.test(n.label ?? '')
        )
        if (!hasGenericLabels && !cancelled) {
          setSeedTopic(topic)
          setSession(id, topic)
          setGraphData(cachedGraph)
          seedCurationFromGraph(cachedGraph)
          setStatus('ready')
          // Refresh read state from DB in the background (not carried in graph cache).
          fetch(`/api/session/${id}/graph`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d && !cancelled && d.readPaperIds?.length) setReadPaperIds(d.readPaperIds) })
            .catch(() => {})
          return
        }
      }

      // Try API (to get fresh labels, or initial load when no cache)
      try {
        const res = await fetch(`/api/session/${id}/graph`)
        if (!res.ok) {
          // Fall back to cache (even with generic labels) before showing error
          if (cachedGraph && !cancelled) {
            setSeedTopic(topic)
            setSession(id, topic)
            setGraphData(cachedGraph)
            seedCurationFromGraph(cachedGraph)
            setStatus('ready')
            return
          }
          const msg = res.status === 404
            ? 'Session not found — it may have expired or been created in an earlier version.'
            : `The graph API returned ${res.status}.`
          throw new Error(msg)
        }
        const data = await res.json()
        if (!cancelled) {
          const t = data.seedTopic ?? topic
          setSeedTopic(t)
          setSession(id, t)
          setGraphData(data.graph)
          setStatus('ready')
          if (data.readPaperIds?.length) setReadPaperIds(data.readPaperIds)
          seedCurationFromArrays(
            data.prunedClusterIds ?? [],
            data.pruneReasons ?? {},
            data.flaggedNodeIds ?? [],
          )
          if (data.sourceIntelligence) {
            setSourceIntelligence(data.sourceIntelligence)
            try { sessionStorage.setItem(`nexus_si_${id}`, JSON.stringify(data.sourceIntelligence)) } catch {}
          }
          sessionStorage.setItem(`nexus_graph_${id}`, JSON.stringify(data.graph))
          if (t) sessionStorage.setItem(`nexus_seed_${id}`, t)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load session.'
          setLoadError(message)
          setStatus('error')
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [id, setSession, retryCount])

  // Multi-tab sync: when another tab writes the graph cache, adopt it here so the
  // two tabs don't diverge. Last write wins; the DB remains the source of truth.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== `nexus_graph_${id}` || !e.newValue) return
      try {
        const next = JSON.parse(e.newValue) as GraphData
        setGraphData(next)
        const pset = new Set<string>()
        const preasons = new Map<string, string>()
        const fset = new Set<string>()
        for (const n of next.nodes) {
          if (n.nodeType === 'cluster' && (n as { isPruned?: boolean }).isPruned) {
            pset.add(n.id)
            const r = (n as { pruneReason?: string }).pruneReason
            if (r) preasons.set(n.id, r)
          }
          if ((n as { isFlagged?: boolean }).isFlagged) fset.add(n.id)
        }
        setPruned(pset)
        setPrunedReasons(preasons)
        setFlagged(fset)
      } catch {}
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [id])

  function handleSelectNode(nodeId: string | null, _type: string | null) {
    selectNode(nodeId)
    if (!nodeId) { setSelectedNode(null); return }
    const node = graphData?.nodes.find((n) => n.id === nodeId) ?? null
    setSelectedNode(node)
  }

  // Write a curation action through to the DB (source of truth). Optimistic UI is
  // already applied by the caller; on failure we roll back via `rollback`.
  const persistAction = useCallback(
    (action: 'prune' | 'unprune' | 'flag' | 'unflag', targetId: string, targetType: string, note: string | null, rollback: () => void) => {
      fetch(`/api/session/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetId, targetType, note }),
        keepalive: true,
      })
        .then((r) => { if (!r.ok) rollback() })
        .catch(rollback)
    },
    [id],
  )

  // Keep the in-memory graph + sessionStorage cache truthful so a cache-hit reload
  // rehydrates curation state from node flags.
  const patchNode = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    setGraphData((prev) => {
      if (!prev) return prev
      const updated: GraphData = {
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } as GraphNode : n)),
      }
      try { sessionStorage.setItem(`nexus_graph_${id}`, JSON.stringify(updated)) } catch {}
      return updated
    })
  }, [id])

  // ─── Snapshots / undo / redo ───────────────────────────────────────────────
  const getCurrentHistory = useCallback((): GraphHistoryState | null => {
    if (!graphData) return null
    return {
      graph: graphData,
      pruned: [...pruned],
      pruneReasons: [...prunedReasons],
      flagged: [...flagged],
    }
  }, [graphData, pruned, prunedReasons, flagged])

  const applyHistoryState = useCallback((s: GraphHistoryState) => {
    setGraphData(s.graph)
    try { sessionStorage.setItem(`nexus_graph_${id}`, JSON.stringify(s.graph)) } catch {}
    setPruned(new Set(s.pruned))
    setPrunedReasons(new Map(s.pruneReasons))
    setFlagged(new Set(s.flagged))
    // Reconcile DB curation so a cold reload matches the restored state.
    fetch(`/api/session/${id}/curation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        prunedClusterIds: s.pruned,
        pruneReasons: Object.fromEntries(s.pruneReasons),
        flaggedNodeIds: s.flagged,
      }),
    }).catch(() => {})
  }, [id])

  const history = useGraphHistory({ getCurrent: getCurrentHistory, applyState: applyHistoryState })
  const { commit: commitHistory } = history

  // Persist current graph as a server checkpoint. `origin` 'auto' for pre-action safety nets.
  const saveCheckpoint = useCallback(async (label: string, origin: 'manual' | 'auto' = 'manual') => {
    if (!graphData) return
    try {
      await fetch(`/api/session/${id}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graph: graphData, label, origin }),
      })
    } catch {}
  }, [id, graphData])

  const autoCheckpoint = useCallback((reason: string) => {
    // Fire-and-forget durable safety net before a destructive change.
    void saveCheckpoint(reason, 'auto')
  }, [saveCheckpoint])

  const handleRevert = useCallback(async (version: number) => {
    // Let the user undo the revert locally.
    commitHistory()
    try {
      const res = await fetch(`/api/session/${id}/snapshots/${version}/revert`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      if (data.graph) {
        setGraphData(data.graph)
        try { sessionStorage.setItem(`nexus_graph_${id}`, JSON.stringify(data.graph)) } catch {}
      }
      setPruned(new Set(data.prunedClusterIds ?? []))
      setPrunedReasons(new Map(Object.entries(data.pruneReasons ?? {})))
      setFlagged(new Set(data.flaggedNodeIds ?? []))
    } catch {}
  }, [id, commitHistory])

  // Keyboard: Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      if (e.shiftKey) history.redo()
      else history.undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history])

  function handlePrune(clusterId: string, reason: string) {
    commitHistory()
    autoCheckpoint('Before prune')
    setPruned((prev) => { const s = new Set(prev); s.add(clusterId); return s })
    setPrunedReasons((prev) => new Map(prev).set(clusterId, reason))
    setSelectedNode((prev) => prev?.id === clusterId ? { ...prev, isPruned: true, pruneReason: reason } as typeof prev : prev)
    patchNode(clusterId, { isPruned: true, pruneReason: reason })
    persistAction('prune', clusterId, 'cluster', reason, () => {
      setPruned((prev) => { const s = new Set(prev); s.delete(clusterId); return s })
      setPrunedReasons((prev) => { const m = new Map(prev); m.delete(clusterId); return m })
      setSelectedNode((prev) => prev?.id === clusterId ? { ...prev, isPruned: false, pruneReason: undefined } as typeof prev : prev)
      patchNode(clusterId, { isPruned: false, pruneReason: undefined })
    })
  }

  function handleUnprune(clusterId: string) {
    commitHistory()
    const prevReason = prunedReasons.get(clusterId)
    setPruned((prev) => { const s = new Set(prev); s.delete(clusterId); return s })
    setPrunedReasons((prev) => { const m = new Map(prev); m.delete(clusterId); return m })
    setSelectedNode((prev) => prev?.id === clusterId ? { ...prev, isPruned: false, pruneReason: undefined } as typeof prev : prev)
    patchNode(clusterId, { isPruned: false, pruneReason: undefined })
    persistAction('unprune', clusterId, 'cluster', null, () => {
      setPruned((prev) => { const s = new Set(prev); s.add(clusterId); return s })
      setPrunedReasons((prev) => new Map(prev).set(clusterId, prevReason ?? ''))
      setSelectedNode((prev) => prev?.id === clusterId ? { ...prev, isPruned: true, pruneReason: prevReason } as typeof prev : prev)
      patchNode(clusterId, { isPruned: true, pruneReason: prevReason })
    })
  }

  function handleFlag(nodeId: string, note: string) {
    commitHistory()
    setFlagged((prev) => { const s = new Set(prev); s.add(nodeId); return s })
    setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, isFlagged: true } as typeof prev : prev)
    patchNode(nodeId, { isFlagged: true })
    const targetType = graphData?.nodes.find((n) => n.id === nodeId)?.nodeType ?? 'outlier'
    persistAction('flag', nodeId, targetType, note, () => {
      setFlagged((prev) => { const s = new Set(prev); s.delete(nodeId); return s })
      setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, isFlagged: false } as typeof prev : prev)
      patchNode(nodeId, { isFlagged: false })
    })
  }

  function flashToast(kind: 'ok' | 'info' | 'error', text: string) {
    setToast({ kind, text })
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 4500)
  }

  function handleGoDeeper() {
    if (!selectedNode || (selectedNode.nodeType !== 'paper' && selectedNode.nodeType !== 'outlier')) {
      flashToast('info', 'Select a paper or outlier first, then Go Deeper to expand its neighborhood.')
      return
    }
    if (!isLoggedIn) {
      setShowGoDeepGate(true)
      return
    }
    const s2Id = (selectedNode as { s2PaperId?: string }).s2PaperId
    if (!s2Id) return
    const sourceTitle = (selectedNode as { title?: string }).title ?? 'this paper'
    // Determine next generation from existing cluster nodes
    const nodes = graphData?.nodes ?? []
    let maxGen = 1
    nodes.forEach((n) => {
      if (n.nodeType === 'cluster') {
        const gen = (n as import('@/lib/types').ClusterNode).generation ?? 1
        if (gen > maxGen) maxGen = gen
      }
    })
    const nextGen = maxGen + 1
    commitHistory()
    setGoingDeeper(true)
    fetch(`/api/expand/${selectedNode.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id, s2PaperId: s2Id, generation: nextGen }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) { flashToast('error', 'Go Deeper failed — try again in a moment.'); return }
        const nodes = (data.newNodes ?? []) as GraphNode[]
        if (nodes.length) {
          const newClusters = nodes.filter((n) => n.nodeType === 'cluster').length
          const newPapers = nodes.filter((n) => n.nodeType === 'paper').length
          setGraphData((prev) => {
            if (!prev) return prev
            const updated: GraphData = {
              nodes: [...prev.nodes, ...nodes],
              edges: [...prev.edges, ...(data.newEdges ?? [])],
            }
            try { sessionStorage.setItem(`nexus_graph_${id}`, JSON.stringify(updated)) } catch {}
            return updated
          })
          flashToast('ok', `Expanded ${sourceTitle.slice(0, 40)}${sourceTitle.length > 40 ? '…' : ''}: +${newPapers} paper${newPapers === 1 ? '' : 's'} in ${newClusters} new cluster${newClusters === 1 ? '' : 's'}.`)
        } else {
          flashToast('info', 'No new related papers found beyond what’s already on the map.')
        }
      })
      .catch(() => flashToast('error', 'Go Deeper failed — check your connection and retry.'))
      .finally(() => setGoingDeeper(false))
  }

  function handleDrillCluster(clusterId: string) {
    if (drilling) return
    if (!isLoggedIn) {
      setShowGoDeepGate(true)
      return
    }
    const cluster = graphData?.nodes.find((n) => n.id === clusterId)
    const topic = cluster && cluster.nodeType === 'cluster' ? cluster.label : 'this cluster'
    const newSessionId = crypto.randomUUID()
    setDrilling(true)
    setDrillProgress({ sessionId: newSessionId, topic })
    fetch('/api/session/drilldown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentSessionId: id, clusterId, newSessionId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.error || !data?.sessionId) {
          setDrillProgress(null)
          flashToast('error', data?.error ?? 'Drill failed — try again in a moment.')
          return
        }
        // Navigate to the new child session (breadcrumb provides the way back).
        router.push(`/session/${data.sessionId}`)
      })
      .catch(() => {
        setDrillProgress(null)
        flashToast('error', 'Drill failed — check your connection and retry.')
      })
      .finally(() => setDrilling(false))
  }

  // Wrong-domain re-run: re-fetch the same seed topic but pin OpenAlex/decompose to a
  // user-corrected field, spawning a fresh session (mirrors SeedInput's create flow).
  async function handleRerunDomain(forcedDomain: string) {
    const fd = forcedDomain.trim()
    if (!fd || !seedTopic) return
    const newSessionId = crypto.randomUUID()
    try {
      const res = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedTopic, sessionId: newSessionId, forcedDomain: fd }),
      })
      const data = await res.json()
      if (!res.ok || data.error || !data.sessionId) {
        flashToast('error', data.error ?? 'Re-run failed — try again in a moment.')
        return
      }
      sessionStorage.setItem(`nexus_graph_${data.sessionId}`, JSON.stringify(data.graph))
      sessionStorage.setItem(`nexus_seed_${data.sessionId}`, seedTopic)
      sessionStorage.setItem(`nexus_ai_available_${data.sessionId}`, String(data.ai_available !== false))
      if (data.ai_reason) sessionStorage.setItem(`nexus_ai_reason_${data.sessionId}`, data.ai_reason)
      if (data.sourceProvider) sessionStorage.setItem(`nexus_source_${data.sessionId}`, data.sourceProvider)
      if (data.queries?.length) sessionStorage.setItem(`nexus_queries_${data.sessionId}`, JSON.stringify(data.queries))
      if (data.sourceIntelligence) sessionStorage.setItem(`nexus_si_${data.sessionId}`, JSON.stringify(data.sourceIntelligence))
      router.push(`/session/${data.sessionId}`)
    } catch {
      flashToast('error', 'Network error — please try again.')
    }
  }

  function handleDirectionsGenerated(directions: DirectionNode[], edges: GraphEdge[]) {
    if (!directions.length) return
    commitHistory()
    setGraphData((prev) => {
      if (!prev) return prev
      const updated: GraphData = {
        nodes: [...prev.nodes, ...directions],
        edges: [...prev.edges, ...edges],
      }
      try { sessionStorage.setItem(`nexus_graph_${id}`, JSON.stringify(updated)) } catch {}
      return updated
    })
  }

  function handleGraphEdit(result: import('@/lib/types').GraphEditResult) {
    commitHistory()
    autoCheckpoint('Before AI edit')
    const removedNodes = new Set(result.removedNodeIds)
    const removedEdges = new Set(result.removedEdgeIds)
    setGraphData((prev) => {
      if (!prev) return prev
      const updated: GraphData = {
        nodes: [...prev.nodes.filter((n) => !removedNodes.has(n.id)), ...result.addedNodes],
        edges: [
          ...prev.edges.filter((e) => !removedEdges.has(e.id) && !removedNodes.has(e.source) && !removedNodes.has(e.target)),
          ...result.addedEdges,
        ],
      }
      try { sessionStorage.setItem(`nexus_graph_${id}`, JSON.stringify(updated)) } catch {}
      return updated
    })
  }

  function handleAiUnavailable(reason: 'quota' | 'error') {
    setAiAvailable(false)
    setAiReason(reason)
    setBannerDismissed(false)
  }

  async function handleApplyDateFilter(min: number, max: number) {
    if (reclustering) return
    commitHistory()
    autoCheckpoint('Before re-cluster')
    setReclustering(true)
    try {
      const res = await fetch('/api/recluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id, dateRange: { min, max } }),
      })
      const data = await res.json()
      if (data.error) { console.warn('[recluster]', data.error); return }
      setGraphData((prev) => {
        const updated = data.graph as typeof prev
        try { sessionStorage.setItem(`nexus_graph_${id}`, JSON.stringify(updated)) } catch {}
        return updated
      })
    } catch (err) {
      console.error('[recluster]', err)
    } finally {
      setReclustering(false)
    }
  }

  function handleExport() {
    if (!graphData) return
    const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `nexus-session-${id}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  function handleJumpToNode(nodeId: string) {
    canvasRef.current?.focusNode(nodeId)
    handleSelectNode(nodeId, null)
  }

  const prunedClusterList = useMemo(() => {
    if (!graphData) return []
    return Array.from(pruned).map((pid) => {
      const node = graphData.nodes.find((n) => n.id === pid)
      const label = node && node.nodeType === 'cluster' ? (node as { label: string }).label : pid
      return { id: pid, label, reason: prunedReasons.get(pid) ?? '' }
    })
  }, [pruned, prunedReasons, graphData])

  const flaggedItems = useMemo(() => {
    if (!graphData) return []
    return Array.from(flagged).map((fid) => {
      const node = graphData.nodes.find((n) => n.id === fid)
      if (!node) return null
      const title =
        node.nodeType === 'paper' ? (node as { title: string }).title :
        node.nodeType === 'cluster' ? (node as { label: string }).label :
        node.nodeType === 'direction' ? (node as { title: string }).title :
        node.nodeType === 'outlier' ? (node as { title: string }).title : fid
      return { id: fid, title, nodeType: node.nodeType as NodeType }
    }).filter(Boolean) as { id: string; title: string; nodeType: NodeType }[]
  }, [flagged, graphData])

  if (status === 'loading') {
    return <LoadingState topic={seedTopic || 'Loading…'} />
  }

  if (status === 'error') {
    return <ErrorState message={loadError ?? undefined} onRetry={() => setRetryCount((c) => c + 1)} />
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden bg-white dark:bg-[#020817] ${isDark ? 'dark' : ''}`}>
      {!aiAvailable && !bannerDismissed && (
        <AIBanner reason={aiReason} onDismiss={() => setBannerDismissed(true)} />
      )}

      {toast && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 max-w-md">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg border text-xs font-medium backdrop-blur-sm ${
              toast.kind === 'ok'
                ? 'bg-emerald-50/95 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : toast.kind === 'error'
                ? 'bg-red-50/95 dark:bg-red-900/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                : 'bg-slate-50/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <span>{toast.text}</span>
            <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">✕</button>
          </div>
        </div>
      )}

      {/* Auth controls + history toolbar — top-right overlay */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-0.5 shadow-sm">
          <button
            onClick={() => history.undo()}
            disabled={!history.canUndo}
            title="Undo (⌘Z)"
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => history.redo()}
            disabled={!history.canRedo}
            title="Redo (⇧⌘Z)"
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          <button
            onClick={() => setHistoryOpen(true)}
            title="History & checkpoints"
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <HistoryIcon className="w-4 h-4" />
          </button>
        </div>
        <AuthButton />
      </div>

      <HistoryPanel
        sessionId={id}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRevert={handleRevert}
        onCheckpoint={(label) => saveCheckpoint(label, 'manual')}
      />

      {showSignInModal && (
        <SignInModal
          title="Sign in to save your session"
          description="Create a free account to save sessions, take notes, and return to your research anytime."
          onClose={() => setShowSignInModal(false)}
        />
      )}

      {/* Go Deeper gate modal */}
      {showGoDeepGate && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowGoDeepGate(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 flex flex-col items-center gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Create a free account</h2>
              <p className="text-sm text-slate-500">Sign in to explore deeper and expand the research map.</p>
            </div>
            <a
              href={`/login?returnTo=${encodeURIComponent(`/session/${id}`)}`}
              className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-medium text-sm shadow-sm transition"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </a>
            <button
              onClick={() => setShowGoDeepGate(false)}
              className="text-xs text-slate-400 hover:text-slate-600 transition"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
      {/* Drill-into-cluster progress — reuses the 6-stage session-create overlay */}
      {drillProgress && (
        <SessionProgress
          sessionId={drillProgress.sessionId}
          topic={`Drilling into “${drillProgress.topic}”`}
          onRetry={() => setDrillProgress(null)}
        />
      )}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <LeftSidebar
          onGoDeeper={handleGoDeeper}
          onExport={handleExport}
          onSave={handleSave}
          isLoggedIn={isLoggedIn}
          isSaved={isSaved}
          saving={saving}
          flaggedItems={flaggedItems}
          onJumpToNode={handleJumpToNode}
          onApplyDateFilter={handleApplyDateFilter}
          aiAvailable={aiAvailable}
          allNodes={graphData?.nodes}
          selectedNodeType={selectedNode?.nodeType ?? null}
          goingDeeper={goingDeeper}
          reclustering={reclustering}
          onRerunDomain={handleRerunDomain}
          width={leftWidth}
        />
        <div className="flex-1 relative overflow-hidden flex">
          {/* left resize handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/30 z-10 transition-colors"
            onPointerDown={startLeftResize}
          />
          <GraphCanvas
            ref={canvasRef}
            data={graphData!}
            layerToggles={layerToggles}
            onSelectNode={handleSelectNode}
            selectedNodeId={selectedNodeId}
            pruned={pruned}
            isDark={isDark}
          />
          {focusedClusterId ? (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
              <button
                onClick={() => setFocusedCluster(null)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-lg transition"
              >
                Exit focus mode
              </button>
            </div>
          ) : (
            <div className="absolute top-3 left-4 z-30">
              <Breadcrumb sessionId={id} />
            </div>
          )}
          {/* right resize handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/30 z-10 transition-colors"
            onPointerDown={startRightResize}
          />
        </div>
        <div style={{ width: selectedNode ? rightWidth : 0, transition: 'width 0.25s', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ width: rightWidth }} className="h-full">
            <RightSidebar
              node={selectedNode}
              onClose={() => handleSelectNode(null, null)}
              onPrune={handlePrune}
              onUnprune={handleUnprune}
              onFlag={handleFlag}
              sessionId={id}
              onDirectionsGenerated={handleDirectionsGenerated}
              onAiUnavailable={handleAiUnavailable}
              prunedClusters={prunedClusterList}
              aiAvailable={aiAvailable}
              allNodes={graphData?.nodes}
              onFindSimilar={handleGoDeeper}
              findingSimilar={goingDeeper}
              isLoggedIn={isLoggedIn}
              onDrillCluster={handleDrillCluster}
              drilling={drilling}
            />
          </div>
        </div>
      </div>
      <ChatBar
        sessionId={id}
        seedTopic={seedTopic}
        graphNodes={graphData?.nodes ?? []}
        selectedNode={selectedNode}
        prunedClusters={prunedClusterList}
        isDark={isDark}
        onDeselect={() => handleSelectNode(null, null)}
        onGraphEdit={handleGraphEdit}
      />
    </div>
  )
}
