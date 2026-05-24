'use client'

import { useEffect, useRef, useState, use } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSessionStore } from '@/store/useSessionStore'
import { MOCK_GRAPH } from '@/lib/mockGraph'
import type { GraphData, GraphNode, NodeType } from '@/lib/types'
import GraphCanvas, { GraphCanvasHandle } from '@/components/explorer/GraphCanvas'
import LeftSidebar from '@/components/explorer/LeftSidebar'
import RightSidebar from '@/components/explorer/RightSidebar'
import BottomBar from '@/components/explorer/BottomBar'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function SessionPage({ params }: PageProps) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const { setSession, selectNode, selectedNodeId, layerToggles, addLog, setFocusNode } = useSessionStore()

  const [graphData] = useState<GraphData>(MOCK_GRAPH)
  const [pruned, setPruned] = useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  const canvasRef = useRef<GraphCanvasHandle>(null)

  useEffect(() => {
    const topic =
      searchParams.get('topic') ||
      (typeof window !== 'undefined' ? sessionStorage.getItem(`nexus_seed_${id}`) : null) ||
      'Unknown topic'
    setSession(id, topic)
  }, [id, searchParams, setSession])

  function handleSelectNode(nodeId: string | null, _type: string | null) {
    selectNode(nodeId)
    if (!nodeId) {
      setSelectedNode(null)
      return
    }
    const node = graphData.nodes.find((n) => n.id === nodeId) ?? null
    setSelectedNode(node)
    if (node) {
      addLog({ actionType: 'select', targetId: nodeId, targetType: node.nodeType as NodeType, label: node.nodeType })
    }
  }

  function handlePrune(clusterId: string, reason: string) {
    setPruned((prev) => {
      const next = new Set(prev)
      next.add(clusterId)
      return next
    })
    addLog({ actionType: 'prune', targetId: clusterId, targetType: 'cluster', note: reason, label: 'Pruned cluster' })
    // Reflect prune state in selected node
    setSelectedNode((prev) => {
      if (!prev || prev.id !== clusterId) return prev
      return { ...prev, isPruned: true, pruneReason: reason } as typeof prev
    })
  }

  function handleFlag(nodeId: string, note: string) {
    addLog({ actionType: 'flag', targetId: nodeId, targetType: (selectedNode?.nodeType ?? 'direction') as NodeType, note, label: 'Flagged' })
    setSelectedNode((prev) => {
      if (!prev || prev.id !== nodeId) return prev
      return { ...prev, isFlagged: true } as typeof prev
    })
  }

  function handleGoDeeper() {
    addLog({ actionType: 'expand', targetId: selectedNodeId ?? 'session', targetType: 'cluster', label: 'Go Deeper' })
  }

  function handleGenerateDirections() {
    addLog({ actionType: 'generate', targetId: 'session', targetType: 'direction', label: 'Generate Directions' })
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `nexus-session-${id}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  function handleJumpToNode(nodeId: string) {
    canvasRef.current?.focusNode(nodeId)
    handleSelectNode(nodeId, null)
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#020817]">
      {/* Main 3-column area */}
      <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: '260px 1fr auto' }}>
        {/* Zone B: Left Sidebar */}
        <LeftSidebar
          onGoDeeper={handleGoDeeper}
          onGenerateDirections={handleGenerateDirections}
          onExport={handleExport}
        />

        {/* Zone A: Graph Canvas */}
        <GraphCanvas
          ref={canvasRef}
          data={graphData}
          layerToggles={layerToggles}
          onSelectNode={handleSelectNode}
          selectedNodeId={selectedNodeId}
          pruned={pruned}
        />

        {/* Zone C: Right Sidebar (conditionally rendered, 360px when open) */}
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

      {/* Zone D: Bottom Bar */}
      <div className="h-14 shrink-0">
        <BottomBar onJumpToNode={handleJumpToNode} />
      </div>
    </div>
  )
}
