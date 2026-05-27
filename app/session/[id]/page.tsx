'use client'

import { useEffect, useRef, useState, use, useMemo } from 'react'
import { useSessionStore } from '@/store/useSessionStore'
import type { GraphData, GraphNode, NodeType, DirectionNode, GraphEdge } from '@/lib/types'
import GraphCanvas, { GraphCanvasHandle } from '@/components/explorer/GraphCanvas'
import LeftSidebar from '@/components/explorer/LeftSidebar'
import RightSidebar from '@/components/explorer/RightSidebar'
import AIBanner from '@/components/explorer/AIBanner'
import LoadingState from '@/components/explorer/LoadingState'
import ErrorState from '@/components/explorer/ErrorState'
import ChatBar from '@/components/explorer/ChatBar'

interface PageProps {
  params: Promise<{ id: string }>
}

type LoadStatus = 'loading' | 'ready' | 'error'

export default function SessionPage({ params }: PageProps) {
  const { id } = use(params)
  const { setSession, selectNode, selectedNodeId, layerToggles, isDark, focusedClusterId, setFocusedCluster, setReadPaperIds } = useSessionStore()

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

  const canvasRef = useRef<GraphCanvasHandle>(null)

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
      <div className="flex flex-1 overflow-hidden min-h-0">
        <LeftSidebar
          onGoDeeper={handleGoDeeper}
          onExport={handleExport}
          flaggedItems={flaggedItems}
          onJumpToNode={handleJumpToNode}
          onApplyDateFilter={handleApplyDateFilter}
          aiAvailable={aiAvailable}
          allNodes={graphData?.nodes}
          selectedNodeType={selectedNode?.nodeType ?? null}
          goingDeeper={goingDeeper}
          reclustering={reclustering}
        />
        <div className="flex-1 relative overflow-hidden">
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
        </div>
        <div style={{ width: selectedNode ? 340 : 0, transition: 'width 0.25s', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ width: 340 }} className="h-full">
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
