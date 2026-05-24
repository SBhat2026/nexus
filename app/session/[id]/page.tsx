'use client'

import { useEffect, useRef, useState, use } from 'react'
import { useSessionStore } from '@/store/useSessionStore'
import type { GraphData, GraphNode, NodeType } from '@/lib/types'
import GraphCanvas, { GraphCanvasHandle } from '@/components/explorer/GraphCanvas'
import LeftSidebar from '@/components/explorer/LeftSidebar'
import RightSidebar from '@/components/explorer/RightSidebar'
import BottomBar from '@/components/explorer/BottomBar'
import LoadingState from '@/components/explorer/LoadingState'
import { MOCK_GRAPH } from '@/lib/mockGraph'

interface PageProps {
  params: Promise<{ id: string }>
}

type LoadStatus = 'loading' | 'ready' | 'error'

export default function SessionPage({ params }: PageProps) {
  const { id } = use(params)
  const { setSession, selectNode, selectedNodeId, layerToggles, addLog } = useSessionStore()

  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [seedTopic, setSeedTopic] = useState('')
  const [pruned, setPruned] = useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  const canvasRef = useRef<GraphCanvasHandle>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Try sessionStorage first (set by SeedInput right after creation)
      const cached = typeof window !== 'undefined'
        ? sessionStorage.getItem(`nexus_graph_${id}`)
        : null
      const topic = typeof window !== 'undefined'
        ? sessionStorage.getItem(`nexus_seed_${id}`) ?? ''
        : ''

      if (cached) {
        try {
          const graph: GraphData = JSON.parse(cached)
          if (!cancelled) {
            setSeedTopic(topic)
            setSession(id, topic)
            setGraphData(graph)
            setStatus('ready')
            return
          }
        } catch { /* fall through to API */ }
      }

      // No cache — fetch from API (handles direct URL navigation or refresh)
      try {
        const res = await fetch(`/api/session/${id}/graph`)
        if (!res.ok) throw new Error(`${res.status}`)
        const data = await res.json()
        if (!cancelled) {
          const t = data.seedTopic ?? topic
          setSeedTopic(t)
          setSession(id, t)
          setGraphData(data.graph)
          setStatus('ready')
        }
      } catch {
        if (!cancelled) {
          // Fall back to mock data so the UI remains usable without env vars
          setSeedTopic('Demo session')
          setSession(id, 'Demo session')
          setGraphData(MOCK_GRAPH)
          setStatus('ready')
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [id, setSession])

  function handleSelectNode(nodeId: string | null, _type: string | null) {
    selectNode(nodeId)
    if (!nodeId) { setSelectedNode(null); return }
    const node = graphData?.nodes.find((n) => n.id === nodeId) ?? null
    setSelectedNode(node)
    if (node) addLog({ actionType: 'select', targetId: nodeId, targetType: node.nodeType as NodeType, label: node.nodeType })
  }

  function handlePrune(clusterId: string, reason: string) {
    setPruned((prev) => { const s = new Set(prev); s.add(clusterId); return s })
    addLog({ actionType: 'prune', targetId: clusterId, targetType: 'cluster', note: reason, label: 'Pruned cluster' })
    setSelectedNode((prev) => prev?.id === clusterId ? { ...prev, isPruned: true, pruneReason: reason } as typeof prev : prev)
  }

  function handleFlag(nodeId: string, note: string) {
    addLog({ actionType: 'flag', targetId: nodeId, targetType: (selectedNode?.nodeType ?? 'direction') as NodeType, note, label: 'Flagged' })
    setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, isFlagged: true } as typeof prev : prev)
  }

  function handleGoDeeper() {
    if (!selectedNode || (selectedNode.nodeType !== 'paper' && selectedNode.nodeType !== 'outlier')) return
    const s2Id = (selectedNode as { s2PaperId?: string }).s2PaperId
    if (!s2Id) return
    addLog({ actionType: 'expand', targetId: selectedNode.id, targetType: selectedNode.nodeType, label: 'Go Deeper' })
    fetch(`/api/expand/${selectedNode.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id, s2PaperId: s2Id }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.newNodes?.length) {
          setGraphData((prev) => prev ? {
            nodes: [...prev.nodes, ...data.newNodes],
            edges: [...prev.edges, ...data.newEdges],
          } : prev)
        }
      })
      .catch(() => {})
  }

  function handleGenerateDirections() {
    addLog({ actionType: 'generate', targetId: 'session', targetType: 'direction', label: 'Generate Directions (Phase 3)' })
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

  if (status === 'loading') {
    return <LoadingState topic={seedTopic || 'Loading…'} />
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#020817]">
      <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: '260px 1fr auto' }}>
        <LeftSidebar
          onGoDeeper={handleGoDeeper}
          onGenerateDirections={handleGenerateDirections}
          onExport={handleExport}
        />
        <GraphCanvas
          ref={canvasRef}
          data={graphData!}
          layerToggles={layerToggles}
          onSelectNode={handleSelectNode}
          selectedNodeId={selectedNodeId}
          pruned={pruned}
        />
        <div style={{ width: selectedNode ? 340 : 0, transition: 'width 0.25s', overflow: 'hidden' }}>
          <div style={{ width: 340 }} className="h-full">
            <RightSidebar
              node={selectedNode}
              onClose={() => handleSelectNode(null, null)}
              onPrune={handlePrune}
              onFlag={handleFlag}
            />
          </div>
        </div>
      </div>
      <div className="h-14 shrink-0">
        <BottomBar onJumpToNode={handleJumpToNode} />
      </div>
    </div>
  )
}
