'use client'

import { useEffect, useRef } from 'react'

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  baseR: number
  hue: number
}

interface Props {
  nodeCount?: number
  connectionRadius?: number
  mouseRadius?: number
  className?: string
}

/**
 * Interactive particle graph background.
 *
 * Renders an animated network of nodes connected by proximity-based edges.
 * Nodes drift with light velocity, repel from the cursor, and edges form/dissolve
 * as nodes move closer/apart. Designed to feel like a living research graph.
 *
 * Uses canvas at devicePixelRatio for crisp lines on retina. Caps at ~60fps.
 */
export default function ParticleGraphBg({
  nodeCount = 70,
  connectionRadius = 140,
  mouseRadius = 180,
  className = '',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const nodesRef = useRef<Node[]>([])
  const mouseRef = useRef({ x: -9999, y: -9999, active: false })
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function resize() {
      if (!canvas) return
      const parent = canvas.parentElement
      if (!parent) return
      const w = parent.clientWidth
      const h = parent.clientHeight
      sizeRef.current = { w, h, dpr }
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function initNodes() {
      const { w, h } = sizeRef.current
      const nodes: Node[] = []
      for (let i = 0; i < nodeCount; i++) {
        const baseR = 1.5 + Math.random() * 2
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          r: baseR,
          baseR,
          // Hue: mostly blues (210-230) with sparse violet accents (260-280)
          hue: Math.random() < 0.85 ? 215 + Math.random() * 15 : 260 + Math.random() * 20,
        })
      }
      nodesRef.current = nodes
    }

    resize()
    initNodes()

    function step() {
      const { w, h } = sizeRef.current
      const mouse = mouseRef.current
      const nodes = nodesRef.current

      ctx!.clearRect(0, 0, w, h)

      // Update positions
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy

        // Soft boundary bounce with damping
        if (n.x < 0 || n.x > w) { n.vx *= -1; n.x = Math.max(0, Math.min(w, n.x)) }
        if (n.y < 0 || n.y > h) { n.vy *= -1; n.y = Math.max(0, Math.min(h, n.y)) }

        // Mouse repulsion + slight attraction at the edge of the influence ring
        if (mouse.active) {
          const dx = n.x - mouse.x
          const dy = n.y - mouse.y
          const dist = Math.hypot(dx, dy)
          if (dist < mouseRadius && dist > 0.1) {
            const force = (1 - dist / mouseRadius) * 0.6
            n.vx += (dx / dist) * force
            n.vy += (dy / dist) * force
            // Grow node radius slightly when influenced
            n.r = n.baseR + force * 2.5
          } else {
            n.r += (n.baseR - n.r) * 0.08
          }
        } else {
          n.r += (n.baseR - n.r) * 0.08
        }

        // Velocity damping (keeps motion gentle)
        n.vx *= 0.985
        n.vy *= 0.985

        // Minimum drift so nodes never freeze
        const speed = Math.hypot(n.vx, n.vy)
        if (speed < 0.05) {
          n.vx += (Math.random() - 0.5) * 0.04
          n.vy += (Math.random() - 0.5) * 0.04
        }
      }

      // Draw edges first (under nodes)
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist < connectionRadius) {
            const t = 1 - dist / connectionRadius
            const alpha = t * 0.22
            ctx!.strokeStyle = `rgba(59, 130, 246, ${alpha})` // blue-500
            ctx!.lineWidth = 0.6
            ctx!.beginPath()
            ctx!.moveTo(a.x, a.y)
            ctx!.lineTo(b.x, b.y)
            ctx!.stroke()
          }
        }

        // Mouse-to-node "halo" edges when close
        if (mouse.active) {
          const dx = a.x - mouse.x
          const dy = a.y - mouse.y
          const dist = Math.hypot(dx, dy)
          if (dist < mouseRadius * 0.8) {
            const t = 1 - dist / (mouseRadius * 0.8)
            ctx!.strokeStyle = `rgba(99, 102, 241, ${t * 0.35})` // indigo-500
            ctx!.lineWidth = 0.8
            ctx!.beginPath()
            ctx!.moveTo(a.x, a.y)
            ctx!.lineTo(mouse.x, mouse.y)
            ctx!.stroke()
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        ctx!.fillStyle = `hsla(${n.hue}, 70%, 55%, 0.75)`
        ctx!.beginPath()
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx!.fill()
      }

      animationRef.current = requestAnimationFrame(step)
    }

    animationRef.current = requestAnimationFrame(step)

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      mouseRef.current.x = e.clientX - rect.left
      mouseRef.current.y = e.clientY - rect.top
      mouseRef.current.active = true
    }

    function onMouseLeave() {
      mouseRef.current.active = false
      mouseRef.current.x = -9999
      mouseRef.current.y = -9999
    }

    function onResize() {
      resize()
      initNodes()
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)
    window.addEventListener('resize', onResize)

    // Respect prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mediaQuery.matches) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('resize', onResize)
    }
  }, [nodeCount, connectionRadius, mouseRadius])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      aria-hidden="true"
    />
  )
}
