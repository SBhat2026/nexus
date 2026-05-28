'use client'

import { useEffect, useRef, useImperativeHandle, forwardRef, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { useSessionStore } from '@/store/useSessionStore'
import type { GraphData, GraphNode, GraphEdge, ClusterNode, PaperNode, DirectionNode, OutlierNode, LayerToggles } from '@/lib/types'

interface TooltipState {
  x: number
  y: number
  paper: {
    title: string
    authors: string[]
    year: number
    venue?: string | null
    citationCount: number
  }
}

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
  isDark: boolean
}

const GraphCanvas = forwardRef<GraphCanvasHandle, Props>(function GraphCanvas(
  { data, layerToggles, onSelectNode, selectedNodeId, pruned, isDark },
  ref
) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDraggingRef = useRef(false)
  // Tracks whether the enter-fade transition is still in progress (prevents focus-dim race)
  const enterAnimatingRef = useRef(false)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const { expandedClusters, toggleCluster, focusedClusterId, setFocusedCluster, readPaperIds, paperFilters, hideRead } = useSessionStore()

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
    const papersPerCluster = Infinity

    // Pre-rank papers per cluster by citation count (desc)
    const papersByCluster = new Map<string, PaperNode[]>()
    data.nodes.forEach((n) => {
      if (n.nodeType === 'paper') {
        const p = n as PaperNode
        if (p.clusterId) {
          const arr = papersByCluster.get(p.clusterId) ?? []
          arr.push(p)
          papersByCluster.set(p.clusterId, arr)
        }
      }
    })
    const topPaperIds = new Set<string>()
    papersByCluster.forEach((papers) => {
      const sorted = [...papers].sort((a, b) => b.citationCount - a.citationCount)
      sorted.slice(0, papersPerCluster).forEach((p) => topPaperIds.add(p.id))
    })

    const ids = new Set<string>()
    const top2OutlierIds = new Set(
      data.nodes
        .filter((n) => n.nodeType === 'outlier')
        .sort((a, b) => (b as OutlierNode).mahalanobisDistance - (a as OutlierNode).mahalanobisDistance)
        .slice(0, 2)
        .map((n) => n.id)
    )
    data.nodes.forEach((n) => {
      if (n.nodeType === 'paper') {
        if (!layerToggles.papers) return
        const p = n as PaperNode
        if (p.clusterId) {
          if (!expandedClusters.has(p.clusterId)) return
          if (!topPaperIds.has(p.id)) return
        }
        // null clusterId = Go Deeper paper, always visible when papers are on
      } else if (n.nodeType === 'direction') {
        if (!layerToggles.directions) return
      } else if (n.nodeType === 'outlier') {
        if (!layerToggles.outliers) return
        if (!top2OutlierIds.has(n.id)) return
      } else if (n.nodeType === 'cluster') {
        if (pruned.has(n.id) && !layerToggles.pruned) return
      }
      ids.add(n.id)
    })
    return ids
  }, [data.nodes, layerToggles, pruned, expandedClusters])

  const visiblePaperCount = useMemo(
    () => data.nodes.filter((n) => visibleNodeIds.has(n.id) && n.nodeType === 'paper').length,
    [data.nodes, visibleNodeIds]
  )

  const totalPaperCount = useMemo(
    () => data.nodes.filter((n) => n.nodeType === 'paper').length,
    [data.nodes]
  )

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return
    const container = containerRef.current
    const width = container.clientWidth || 900
    const height = container.clientHeight || 600

    const canvasBg = isDark ? '#020817' : '#f8fafc'
    const labelColor = isDark ? '#cbd5e1' : '#1e293b'
    const mutedColor = isDark ? '#64748b' : '#94a3b8'
    const edgeCitationColor = isDark ? '#475569' : '#94a3b8'
    const paperFill = isDark ? '#475569' : '#94a3b8'
    const paperStroke = isDark ? '#94a3b8' : '#475569'
    const legendBg = isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.92)'
    const legendBorder = isDark ? '#334155' : '#e2e8f0'
    const legendText = isDark ? '#94a3b8' : '#475569'

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)
      .style('background', canvasBg)

    const defs = svg.append('defs')
    defs.append('pattern')
      .attr('id', 'hatch')
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 6).attr('height', 6)
      .append('path')
      .attr('d', 'M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2')
      .attr('stroke', isDark ? '#475569' : '#cbd5e1').attr('stroke-width', 1)

    const g = svg.append('g').attr('class', 'graph-root')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom)
    zoomRef.current = zoom

    const nodes = data.nodes
      .filter((n) => visibleNodeIds.has(n.id))
      .map((n) => ({ ...n })) as GraphNode[]

    // Position via UMAP coords — fallback to radial spread
    const hasUmap = nodes.some((n) => n.umapX !== undefined && n.umapY !== undefined)
    const pad = 100
    const scaleX = d3.scaleLinear().domain([0, 1]).range([pad, width - pad])
    const scaleY = d3.scaleLinear().domain([0, 1]).range([pad, height - pad])

    nodes.forEach((n, i) => {
      if (n.umapX !== undefined && n.umapY !== undefined) {
        n.fx = scaleX(n.umapX)
        n.fy = scaleY(n.umapY)
      } else if (!hasUmap) {
        // Radial fallback when no umap coords exist
        const angle = (2 * Math.PI * i) / nodes.length
        const r = Math.min(width, height) * 0.35
        n.fx = width / 2 + r * Math.cos(angle)
        n.fy = height / 2 + r * Math.sin(angle)
      }
    })

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
      .force('collision', d3.forceCollide<GraphNode>().radius((d) => {
        if (d.nodeType === 'cluster') return 60
        if (d.nodeType === 'direction') return 40
        return 22
      }))
      .alphaDecay(0.05)

    simRef.current = sim

    // Edges
    const edgeGroup = g.append('g').attr('class', 'edges')
    const edgeSel = edgeGroup.selectAll<SVGLineElement, GraphEdge>('line')
      .data(edges).enter().append('line')
      .attr('stroke', (e) => {
        if (e.edgeType === 'citation') return edgeCitationColor
        if (e.edgeType === 'semantic_similarity') return '#3b82f6'
        return '#f59e0b'
      })
      .attr('stroke-width', (e) => e.edgeType === 'citation' ? 1 : 1.5)
      .attr('stroke-dasharray', (e) => {
        if (e.edgeType === 'semantic_similarity') return '4 2'
        if (e.edgeType === 'generated_from') return '2 4'
        return 'none'
      })
      .attr('stroke-opacity', 0.25)

    // Nodes
    const nodeGroup = g.append('g').attr('class', 'nodes')
    const nodeSel = nodeGroup.selectAll<SVGGElement, GraphNode>('g')
      .data(nodes, (d) => d.id).enter().append('g')
      .attr('class', 'node-group')
      .attr('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', () => {
            isDraggingRef.current = true
            if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
            setTooltip(null)
          })
          .on('end', () => { isDraggingRef.current = false })
      )
      .on('click', (event, d) => {
        event.stopPropagation()
        onSelectNode(d.id, d.nodeType)
        if (d.nodeType === 'cluster') toggleCluster(d.id)
      })

    svg.on('click', () => onSelectNode(null, null))

    // Render shapes
    nodeSel.each(function (d) {
      const el = d3.select(this)
      const isPruned = d.nodeType === 'cluster' && pruned.has(d.id)

      if (d.nodeType === 'cluster') {
        const c = d as ClusterNode
        const color = '#3b82f6'
        const quality = c.clusterQuality ?? 0.5
        const isExpanded = expandedClusters.has(c.id)
        const currentYear = new Date().getFullYear()
        const isStale = typeof c.medianYear === 'number' && c.medianYear < currentYear - 3

        // Confidence ring — dashed amber when median paper year is > 3 years old
        el.append('circle')
          .attr('r', 32)
          .attr('fill', 'none')
          .attr('stroke', isStale ? '#f59e0b' : color)
          .attr('stroke-width', isExpanded ? 2.5 : 1.5)
          .attr('stroke-opacity', isStale ? 0.75 : 0.15 + 0.85 * quality)
          .attr('stroke-dasharray', isStale ? '4 2' : null)

        el.append('circle')
          .attr('r', 26)
          .attr('fill', isPruned ? 'url(#hatch)' : color + '33')
          .attr('stroke', isPruned ? (isDark ? '#475569' : '#cbd5e1') : color)
          .attr('stroke-width', 2)
          .attr('opacity', isPruned ? 0.4 : 1)

        // Paper count inside circle
        el.append('text')
          .text(String(c.paperCount))
          .attr('text-anchor', 'middle').attr('dy', 5)
          .attr('fill', isPruned ? mutedColor : color)
          .attr('font-size', 13).attr('font-weight', 'bold')

        // Cluster label ABOVE the node
        const labelText = c.label.length > 30 ? c.label.slice(0, 28) + '…' : c.label
        // Background rect for readability
        el.append('rect')
          .attr('x', -52).attr('y', -54)
          .attr('width', 104).attr('height', 16)
          .attr('rx', 3)
          .attr('fill', isDark ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.85)')

        el.append('text')
          .text(labelText)
          .attr('text-anchor', 'middle').attr('dy', -42)
          .attr('fill', isPruned ? mutedColor : labelColor)
          .attr('font-size', 11).attr('font-weight', '600')

        // Expand indicator
        el.append('text')
          .text(isExpanded ? '▾' : '▸')
          .attr('text-anchor', 'middle').attr('dy', 40)
          .attr('fill', color).attr('font-size', 9)
          .attr('opacity', 0.6)

      } else if (d.nodeType === 'paper') {
        const p = d as PaperNode
        const r = Math.max(5, Math.min(14, Math.sqrt(p.citationCount / 300) + 4))
        el.append('circle').attr('r', r).attr('fill', paperFill).attr('stroke', paperStroke).attr('stroke-width', 1)

        // Paper title above — only for representative papers to prevent overlap
        if (p.isRepresentative) {
          const shortTitle = p.title.length > 24 ? p.title.slice(0, 22) + '…' : p.title
          el.append('rect')
            .attr('x', -52).attr('y', -r - 16)
            .attr('width', 104).attr('height', 13)
            .attr('rx', 2)
            .attr('fill', isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.8)')
          el.append('text')
            .text(shortTitle)
            .attr('text-anchor', 'middle').attr('dy', -r - 5)
            .attr('fill', labelColor).attr('font-size', 8)
        }

      } else if (d.nodeType === 'direction') {
        const dd = d as DirectionNode
        const pts = hexagonPoints(0, 0, 18)
        el.append('polygon')
          .attr('points', pts)
          .attr('fill', dd.isFlagged ? '#f59e0b66' : '#f59e0b33')
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', 2)

        // Direction title above
        const shortTitle = dd.title.length > 22 ? dd.title.slice(0, 20) + '…' : dd.title
        el.append('rect')
          .attr('x', -52).attr('y', -32)
          .attr('width', 104).attr('height', 13)
          .attr('rx', 2)
          .attr('fill', isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.8)')
        el.append('text')
          .text(shortTitle)
          .attr('text-anchor', 'middle').attr('dy', -21)
          .attr('fill', isDark ? '#fcd34d' : '#92400e').attr('font-size', 9).attr('font-weight', '600')

      } else if (d.nodeType === 'outlier') {
        el.append('circle').attr('r', 7).attr('class', 'outlier-ring')
          .attr('fill', 'none').attr('stroke', '#f97316').attr('stroke-width', 1.5)
        el.append('circle').attr('r', 7).attr('fill', '#f9731633').attr('stroke', '#f97316').attr('stroke-width', 2)
      }

      // Selection ring
      el.append('circle')
        .attr('class', 'select-ring')
        .attr('r', d.nodeType === 'cluster' ? 36 : d.nodeType === 'direction' ? 24 : 14)
        .attr('fill', 'none')
        .attr('stroke', isDark ? '#e2e8f0' : '#1e293b')
        .attr('stroke-width', 2)
        .attr('opacity', 0)

      // Hover tooltip — paper and outlier nodes only
      if (d.nodeType === 'paper' || d.nodeType === 'outlier') {
        const p = d as PaperNode
        el
          .on('mouseenter', function (event: MouseEvent) {
            if (isDraggingRef.current) return
            const container = containerRef.current
            if (!container) return
            const rect = container.getBoundingClientRect()
            if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
            const ex = event.clientX - rect.left
            const ey = event.clientY - rect.top
            tooltipTimerRef.current = setTimeout(() => {
              setTooltip({
                x: ex,
                y: ey,
                paper: {
                  title: p.title,
                  authors: p.authors,
                  year: p.year,
                  venue: p.venue,
                  citationCount: p.citationCount,
                },
              })
            }, 300)
          })
          .on('mouseleave', () => {
            if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
            setTooltip(null)
          })
      }
    })

    nodeSel.append('title').text((d) => {
      if (d.nodeType === 'paper') return `${(d as PaperNode).title} (${(d as PaperNode).year})`
      if (d.nodeType === 'cluster') {
        const c = d as ClusterNode
        const q = c.clusterQuality !== undefined ? ` · quality ${(c.clusterQuality * 100).toFixed(0)}%` : ''
        return `${c.label}${q} — click to expand`
      }
      if (d.nodeType === 'direction') return (d as DirectionNode).title
      if (d.nodeType === 'outlier') return (d as OutlierNode).title
      return ''
    })

    // Enter fade-in — nodes and edges appear instead of popping
    edgeSel.attr('stroke-opacity', 0)
      .transition().duration(250)
      .attr('stroke-opacity', 0.25)
    nodeSel.attr('opacity', 0)
      .transition().duration(250)
      .attr('opacity', 1)

    sim.on('tick', () => {
      edgeSel
        .attr('x1', (e) => ((e.source as unknown) as GraphNode).x ?? 0)
        .attr('y1', (e) => ((e.source as unknown) as GraphNode).y ?? 0)
        .attr('x2', (e) => ((e.target as unknown) as GraphNode).x ?? 0)
        .attr('y2', (e) => ((e.target as unknown) as GraphNode).y ?? 0)
      nodeSel.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    // Legend is rendered as a React overlay — see JSX below

    // Signal that the enter animation is in flight so the focus effect delays correctly
    enterAnimatingRef.current = true
    const enterAnimTimer = setTimeout(() => { enterAnimatingRef.current = false }, 280)

    return () => {
      sim.stop()
      clearTimeout(enterAnimTimer)
      enterAnimatingRef.current = false
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
      setTooltip(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, layerToggles, pruned, visibleNodeIds, expandedClusters, isDark])

  useEffect(() => {
    if (!svgRef.current) return
    d3.select(svgRef.current)
      .selectAll<SVGCircleElement, GraphNode>('.select-ring')
      .attr('opacity', (d) => (d.id === selectedNodeId ? 1 : 0))
  }, [selectedNodeId])

  // Focus mode + read-paper dim + paper filters: lightweight — no simulation restart
  // Includes visibleNodeIds in deps so it re-runs after graph data changes (e.g. directions added).
  // Delays when the enter-fade animation is in flight to avoid being overridden.
  useEffect(() => {
    if (!svgRef.current) return

    function applyOpacity() {
      if (!svgRef.current) return
      d3.select(svgRef.current)
        .selectAll<SVGGElement, GraphNode>('.node-group')
        .attr('opacity', (d) => {
          let opacity = 1

          // Focus mode
          if (focusedClusterId && d.nodeType !== 'direction') {
            const clId = d.nodeType === 'cluster'
              ? d.id
              : (d as PaperNode).clusterId ?? (d as OutlierNode).nearestClusterId ?? ''
            if (clId !== focusedClusterId) opacity = 0.15
          }

          // Read paper dimming
          if (d.nodeType === 'paper' && readPaperIds.has(d.id)) opacity *= 0.4

          // Paper filters (paper and outlier nodes)
          if (d.nodeType === 'paper' || d.nodeType === 'outlier') {
            const p = d as PaperNode
            const { authors, venues, yearMin, yearMax } = paperFilters
            const filteredByAuthor = authors.size > 0 && !p.authors.some((a) => authors.has(a))
            const filteredByVenue = venues.size > 0 && !venues.has((p.venue ?? '(no venue)'))
            const filteredByYear =
              (yearMin !== null && p.year < yearMin) ||
              (yearMax !== null && p.year > yearMax)
            const filteredByRead = hideRead && readPaperIds.has(d.id)
            if (filteredByAuthor || filteredByVenue || filteredByYear || filteredByRead) {
              opacity = Math.min(opacity, 0.1)
            }
          }

          return opacity
        })
    }

    if (enterAnimatingRef.current) {
      const handle = setTimeout(applyOpacity, 280)
      return () => clearTimeout(handle)
    }
    applyOpacity()
  }, [focusedClusterId, readPaperIds, paperFilters, hideRead, visibleNodeIds])

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Escape' && focusedClusterId) setFocusedCluster(null) }}
    >
      <svg ref={svgRef} className="w-full h-full" />

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg px-3 py-2 max-w-[240px]"
          style={{
            left: tooltip.x + 248 > (containerRef.current?.clientWidth ?? 9999)
              ? tooltip.x - 256
              : tooltip.x + 14,
            top: Math.max(8, tooltip.y - 12),
          }}
        >
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 mb-1">
            {tooltip.paper.title}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
            {tooltip.paper.authors.slice(0, 3).join(', ')}{tooltip.paper.authors.length > 3 ? ' et al.' : ''}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span className="font-mono tabular-nums">{tooltip.paper.year}</span>
            {tooltip.paper.venue ? ` · ${tooltip.paper.venue.length > 20 ? tooltip.paper.venue.slice(0, 18) + '…' : tooltip.paper.venue}` : ''}
            {' · '}<span className="font-mono tabular-nums">{tooltip.paper.citationCount.toLocaleString()}</span> cites
          </p>
        </div>
      )}

      {/* Paper count overlay */}
      <div className="absolute top-3 right-52 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
        bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700
        text-slate-500 dark:text-slate-400 backdrop-blur-sm">
        <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-semibold">{visiblePaperCount}</span>
        <span> / </span>
        <span className="font-mono tabular-nums">{totalPaperCount}</span>
        <span> papers visible</span>
      </div>

      {/* Legend overlay */}
      <div className="absolute bottom-4 left-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg px-3 py-2.5 space-y-1.5 min-w-[168px]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Legend</p>
        {[
          {
            icon: <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="#3b82f633" stroke="#3b82f6" strokeWidth="2"/><text x="9" y="13" textAnchor="middle" fontSize="8" fill="#3b82f6" fontWeight="bold">n</text></svg>,
            label: 'Cluster', sub: 'click to expand',
          },
          {
            icon: <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="5" fill="#94a3b8" stroke="#64748b" strokeWidth="1.5"/></svg>,
            label: 'Paper', sub: 'size = citations',
          },
          {
            icon: <svg width="18" height="18" viewBox="0 0 18 18"><polygon points="9,1 16.5,5 16.5,13 9,17 1.5,13 1.5,5" fill="#f59e0b33" stroke="#f59e0b" strokeWidth="1.5"/></svg>,
            label: 'Direction', sub: 'AI-generated',
          },
          {
            icon: <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6" fill="#f9731633" stroke="#f97316" strokeWidth="2"/><circle cx="9" cy="9" r="9" fill="none" stroke="#f97316" strokeWidth="1" strokeOpacity="0.4"/></svg>,
            label: 'Outlier', sub: 'bridge paper',
          },
        ].map(({ icon, label, sub }) => (
          <div key={label} className="flex items-center gap-2.5">
            <div className="shrink-0 flex items-center justify-center w-[18px] h-[18px]">{icon}</div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">{sub}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

export default GraphCanvas
