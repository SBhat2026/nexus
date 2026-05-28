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

interface PageProps {
  params: Promise<{ id: string }>
}

type LoadStatus = 'loading' | 'ready' | 'error'

export default function SessionPage({ params }: PageProps) {
  const { id } = use(params)
  const { setSession, selectNode, selectedNodeId, layerToggles, isDark, focusedClusterId, setFocusedCluster, setReadPaperIds, setSourceProvider } = useSessionStore()

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
  const [reclustering, setReclustering] = useState(false)

  const [leftWidth, setLeftWidth] = useState(260)
  const [rightWidth, setRightWidth] = useState(340)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [showGoDeepGate, setShowGoDeepGate] = useState(false)

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
          setStatus('ready')
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

  function handleSelectNode(nodeId: string | null, _type: string | null) {
    selectNode(nodeId)
    if (!nodeId) { setSelectedNode(null); return }
    const node = graphData?.nodes.find((n) => n.id === nodeId) ?? null
    setSelectedNode(node)
  }

  function handlePrune(clusterId: string, reason: string) {
    setPruned((prev) => { const s = new Set(prev); s.add(clusterId); return s })
    setPrunedReasons((prev) => new Map(prev).set(clusterId, reason))
    setSelectedNode((prev) => prev?.id === clusterId ? { ...prev, isPruned: true, pruneReason: reason } as typeof prev : prev)
  }

  function handleUnprune(clusterId: string) {
    setPruned((prev) => { const s = new Set(prev); s.delete(clusterId); return s })
    setSelectedNode((prev) => prev?.id === clusterId ? { ...prev, isPruned: false, pruneReason: undefined } as typeof prev : prev)
  }

  function handleFlag(nodeId: string, _note: string) {
    setFlagged((prev) => { const s = new Set(prev); s.add(nodeId); return s })
    setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, isFlagged: true } as typeof prev : prev)
  }

  function handleGoDeeper() {
    if (!selectedNode || (selectedNode.nodeType !== 'paper' && selectedNode.nodeType !== 'outlier')) return
    if (!isLoggedIn) {
      setShowGoDeepGate(true)
      return
    }
    const s2Id = (selectedNode as { s2PaperId?: string }).s2PaperId
    if (!s2Id) return
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
    setGoingDeeper(true)
    fetch(`/api/expand/${selectedNode.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id, s2PaperId: s2Id, generation: nextGen }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.newNodes?.length) {
          setGraphData((prev) => {
            if (!prev) return prev
            const updated: GraphData = {
              nodes: [...prev.nodes, ...data.newNodes],
              edges: [...prev.edges, ...data.newEdges],
            }
            try { sessionStorage.setItem(`nexus_graph_${id}`, JSON.stringify(updated)) } catch {}
            return updated
          })
        }
      })
      .catch(() => {})
      .finally(() => setGoingDeeper(false))
  }

  function handleDirectionsGenerated(directions: DirectionNode[], edges: GraphEdge[]) {
    if (!directions.length) return
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

  function handleAiUnavailable(reason: 'quota' | 'error') {
    setAiAvailable(false)
    setAiReason(reason)
    setBannerDismissed(false)
  }

  async function handleApplyDateFilter(min: number, max: number) {
    if (reclustering) return
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

      {/* Auth controls — top-right overlay */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
        <AuthButton />
      </div>

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
          {focusedClusterId && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
              <button
                onClick={() => setFocusedCluster(null)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-lg transition"
              >
                Exit focus mode
              </button>
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
      />
    </div>
  )
}
