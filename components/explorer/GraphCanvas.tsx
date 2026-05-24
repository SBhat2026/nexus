'use client'

import { useEffect, useRef, useImperativeHandle, forwardRef, useMemo } from 'react'
import * as d3 from 'd3'
import type { GraphData, GraphNode, GraphEdge, ClusterNode, PaperNode, DirectionNode, OutlierNode, LayerToggles } from '@/lib/types'

const FIELD_COLORS: Record<string, string> = {
  machine_learning: '#3b82f6',
  systems: '#8b5cf6',
  nlp: '#10b981',
  biology: '#f59e0b',
  chemistry: '#ef4444',
  physics: '#06b6d4',
  economics: '#f97316',
  neuroscience: '#ec4899',
  mathematics: '#a3e635',
  default: '#64748b',
}

function hexagonPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
  }).join(' ')
}

export interface GraphCanvasHandle {
  focusNode: (id: string) => void
}

interface Props {
  data: GraphData
  layerToggles: LayerToggles
  onSelectNode: (id: string | null, type: string | null) => void
  selectedNodeId: string | null
  pruned: Set<string>
}

const GraphCanvas = forwardRef<GraphCanvasHandle, Props>(function GraphCanvas(
  { data, layerToggles, onSelectNode, selectedNodeId, pruned },
  ref
) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  useImperativeHandle(ref, () => ({
    focusNode(id: string) {
      const node = data.nodes.find((n) => n.id === id)
      if (!node || !svgRef.current || !zoomRef.current) return
      const svg = d3.select(svgRef.current)
      const { width, height } = svgRef.current.getBoundingClientRect()
      svg.transition().duration(600).call(
        zoomRef.current.transform,
        d3.zoomIdentity.translate(width / 2 - (node.x ?? 0), height / 2 - (node.y ?? 0))
      )
    },
  }))

  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>()
    data.nodes.forEach((n) => {
      if (n.nodeType === 'paper' && !layerToggles.papers) return
      if (n.nodeType === 'direction' && !layerToggles.directions) return
      if (n.nodeType === 'outlier' && !layerToggles.outliers) return
      if ((n.nodeType === 'cluster') && pruned.has(n.id) && !layerToggles.pruned) return
      ids.add(n.id)
    })
    return ids
  }, [data.nodes, layerToggles, pruned])

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return
    const container = containerRef.current
    const width = container.clientWidth || 900
    const height = container.clientHeight || 600

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    // Defs: hatch pattern for pruned clusters
    const defs = svg.append('defs')
    defs.append('pattern')
      .attr('id', 'hatch')
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 6).attr('height', 6)
      .append('path')
      .attr('d', 'M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2')
      .attr('stroke', '#475569').attr('stroke-width', 1)

    const g = svg.append('g').attr('class', 'graph-root')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom)
    zoomRef.current = zoom

    // Filter nodes and edges by visibility
    const nodes = data.nodes
      .filter((n) => visibleNodeIds.has(n.id))
      .map((n) => ({ ...n })) as GraphNode[]

    const nodeSet = new Set(nodes.map((n) => n.id))
    const edges = data.edges
      .filter((e) => {
        if (!nodeSet.has(e.source as string) || !nodeSet.has(e.target as string)) return false
        if (e.edgeType === 'citation' && !layerToggles.citationEdges) return false
        if (e.edgeType === 'semantic_similarity' && !layerToggles.semanticEdges) return false
        if (e.edgeType === 'generated_from' && !layerToggles.generatedEdges) return false
        return true
      })
      .map((e) => ({ ...e })) as GraphEdge[]

    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(edges)
        .id((d) => d.id)
        .distance((e) => {
          if (e.edgeType === 'generated_from') return 140
          if (e.edgeType === 'semantic_similarity') return 90
          return 70
        })
        .strength(0.4))
      .force('charge', d3.forceManyBody().strength(-260))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius((d) => {
        if (d.nodeType === 'cluster') return 50
        if (d.nodeType === 'direction') return 40
        return 22
      }))
    simRef.current = sim

    // Edges
    const edgeGroup = g.append('g').attr('class', 'edges')
    const edgeSel = edgeGroup.selectAll<SVGLineElement, GraphEdge>('line')
      .data(edges).enter().append('line')
      .attr('stroke', (e) => {
        if (e.edgeType === 'citation') return '#475569'
        if (e.edgeType === 'semantic_similarity') return '#3b82f6'
        return '#f59e0b'
      })
      .attr('stroke-width', (e) => e.edgeType === 'citation' ? 1 : 1.5)
      .attr('stroke-dasharray', (e) => {
        if (e.edgeType === 'semantic_similarity') return '4 2'
        if (e.edgeType === 'generated_from') return '2 4'
        return 'none'
      })
      .attr('stroke-opacity', 0.45)

    // Nodes group
    const nodeGroup = g.append('g').attr('class', 'nodes')
    const nodeSel = nodeGroup.selectAll<SVGGElement, GraphNode>('g')
      .data(nodes, (d) => d.id).enter().append('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => {
            if (!event.active) sim.alphaTarget(0)
            d.fx = null; d.fy = null
          })
      )
      .on('click', (event, d) => {
        event.stopPropagation()
        onSelectNode(d.id, d.nodeType)
      })

    // Deselect on canvas click
    svg.on('click', () => onSelectNode(null, null))

    // Render shapes per node type
    nodeSel.each(function (d) {
      const el = d3.select(this)
      const isPruned = d.nodeType === 'cluster' && pruned.has(d.id)

      if (d.nodeType === 'cluster') {
        const c = d as ClusterNode
        const color = FIELD_COLORS[c.field] ?? FIELD_COLORS.default
        el.append('circle')
          .attr('r', 26)
          .attr('fill', isPruned ? 'url(#hatch)' : color + '33')
          .attr('stroke', isPruned ? '#475569' : color)
          .attr('stroke-width', 2)
          .attr('opacity', isPruned ? 0.4 : 1)
        el.append('text')
          .text(c.label.length > 16 ? c.label.slice(0, 14) + '…' : c.label)
          .attr('text-anchor', 'middle').attr('dy', 38)
          .attr('fill', isPruned ? '#475569' : '#cbd5e1')
          .attr('font-size', 10)
      } else if (d.nodeType === 'paper') {
        const p = d as PaperNode
        const r = Math.max(5, Math.min(14, Math.sqrt(p.citationCount / 300) + 4))
        el.append('circle').attr('r', r).attr('fill', '#475569').attr('stroke', '#94a3b8').attr('stroke-width', 1)
      } else if (d.nodeType === 'direction') {
        const dd = d as DirectionNode
        const pts = hexagonPoints(0, 0, 18)
        el.append('polygon')
          .attr('points', pts)
          .attr('fill', dd.isFlagged ? '#f59e0b66' : '#f59e0b33')
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', 2)
        el.append('text')
          .text(dd.title.length > 18 ? dd.title.slice(0, 16) + '…' : dd.title)
          .attr('text-anchor', 'middle').attr('dy', 30)
          .attr('fill', '#fcd34d').attr('font-size', 9)
      } else if (d.nodeType === 'outlier') {
        // Pulsing ring rendered below
        el.append('circle').attr('r', 7).attr('class', 'outlier-ring')
          .attr('fill', 'none').attr('stroke', '#f97316').attr('stroke-width', 1.5)
        el.append('circle').attr('r', 7).attr('fill', '#f9731633').attr('stroke', '#f97316').attr('stroke-width', 2)
      }

      // Selection ring
      el.append('circle')
        .attr('class', 'select-ring')
        .attr('r', d.nodeType === 'cluster' ? 32 : d.nodeType === 'direction' ? 24 : 14)
        .attr('fill', 'none')
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 2)
        .attr('opacity', 0)
    })

    // Tooltip title
    nodeSel.append('title').text((d) => {
      if (d.nodeType === 'paper') return `${(d as PaperNode).title} (${(d as PaperNode).year})`
      if (d.nodeType === 'cluster') return (d as ClusterNode).label
      if (d.nodeType === 'direction') return (d as DirectionNode).title
      if (d.nodeType === 'outlier') return (d as OutlierNode).title
      return ''
    })

    sim.on('tick', () => {
      edgeSel
        .attr('x1', (e) => ((e.source as unknown) as GraphNode).x ?? 0)
        .attr('y1', (e) => ((e.source as unknown) as GraphNode).y ?? 0)
        .attr('x2', (e) => ((e.target as unknown) as GraphNode).x ?? 0)
        .attr('y2', (e) => ((e.target as unknown) as GraphNode).y ?? 0)

      nodeSel.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => { sim.stop() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, layerToggles, pruned, visibleNodeIds])

  // Update selection rings without re-running sim
  useEffect(() => {
    if (!svgRef.current) return
    d3.select(svgRef.current)
      .selectAll<SVGCircleElement, GraphNode>('.select-ring')
      .attr('opacity', (d) => (d.id === selectedNodeId ? 1 : 0))
  }, [selectedNodeId])

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-[#020817]">
      <svg ref={svgRef} className="w-full h-full" />
      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 text-xs text-slate-400 bg-slate-900/80 rounded-lg px-3 py-2 border border-slate-700">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500/30 border border-blue-500 inline-block" /> Cluster</div>
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block" /> Paper</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 inline-block" style={{ background: '#f59e0b33', border: '2px solid #f59e0b', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} /> Direction</div>
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-orange-500/30 border border-orange-500 inline-block" /> Outlier</div>
      </div>
    </div>
  )
})

export default GraphCanvas
