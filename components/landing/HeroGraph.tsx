'use client'

import { useEffect, useRef } from 'react'

const CYCLE = 24000 // ms per animation loop

// Node definitions: bx/by are fractions [0,1] of canvas size
const BASE = [
  // Clusters
  { id: 'c1', t: 'cluster', bx: 0.18, by: 0.40, r: 22, cl: 'c1', prune: false },
  { id: 'c2', t: 'cluster', bx: 0.58, by: 0.22, r: 20, cl: 'c2', prune: false },
  { id: 'c3', t: 'cluster', bx: 0.40, by: 0.72, r: 24, cl: 'c3', prune: true },
  { id: 'c4', t: 'cluster', bx: 0.82, by: 0.56, r: 18, cl: 'c4', prune: false },
  // Papers — cluster 1
  { id: 'p1a', t: 'paper', bx: 0.09, by: 0.30, r: 5, cl: 'c1', prune: false },
  { id: 'p1b', t: 'paper', bx: 0.11, by: 0.51, r: 6, cl: 'c1', prune: false },
  { id: 'p1c', t: 'paper', bx: 0.27, by: 0.28, r: 4, cl: 'c1', prune: false },
  { id: 'p1d', t: 'paper', bx: 0.28, by: 0.50, r: 5, cl: 'c1', prune: false },
  { id: 'p1e', t: 'paper', bx: 0.06, by: 0.43, r: 4, cl: 'c1', prune: false },
  // Papers — cluster 2
  { id: 'p2a', t: 'paper', bx: 0.48, by: 0.15, r: 5, cl: 'c2', prune: false },
  { id: 'p2b', t: 'paper', bx: 0.68, by: 0.13, r: 6, cl: 'c2', prune: false },
  { id: 'p2c', t: 'paper', bx: 0.69, by: 0.30, r: 4, cl: 'c2', prune: false },
  { id: 'p2d', t: 'paper', bx: 0.47, by: 0.32, r: 5, cl: 'c2', prune: false },
  // Papers — cluster 3 (pruned)
  { id: 'p3a', t: 'paper', bx: 0.29, by: 0.65, r: 5, cl: 'c3', prune: true },
  { id: 'p3b', t: 'paper', bx: 0.30, by: 0.80, r: 6, cl: 'c3', prune: true },
  { id: 'p3c', t: 'paper', bx: 0.48, by: 0.79, r: 4, cl: 'c3', prune: true },
  { id: 'p3d', t: 'paper', bx: 0.52, by: 0.67, r: 5, cl: 'c3', prune: true },
  { id: 'p3e', t: 'paper', bx: 0.37, by: 0.86, r: 4, cl: 'c3', prune: true },
  // Papers — cluster 4
  { id: 'p4a', t: 'paper', bx: 0.76, by: 0.49, r: 5, cl: 'c4', prune: false },
  { id: 'p4b', t: 'paper', bx: 0.90, by: 0.52, r: 4, cl: 'c4', prune: false },
  { id: 'p4c', t: 'paper', bx: 0.89, by: 0.65, r: 5, cl: 'c4', prune: false },
  // Outlier
  { id: 'o1', t: 'outlier', bx: 0.70, by: 0.44, r: 6, cl: '', prune: false },
] as const

// Direction nodes (appear in directions phase, linked to c1)
const DIRS = [
  { id: 'd1', bx: 0.06, by: 0.60, r: 13 },
  { id: 'd2', bx: 0.31, by: 0.26, r: 13 },
] as const

// New paper nodes (appear in go-deeper phase, linked to c2)
const DEEP = [
  { id: 'dp1', bx: 0.46, by: 0.07, r: 4 },
  { id: 'dp2', bx: 0.62, by: 0.05, r: 5 },
  { id: 'dp3', bx: 0.74, by: 0.09, r: 4 },
] as const

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}
function ease(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6
    if (i === 0) ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
    else ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
  }
  ctx.closePath()
}

export default function HeroGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const el = canvas // non-nullable alias for use inside closures
    const ctx = el.getContext('2d')!
    let raf = 0
    const dpr = window.devicePixelRatio || 1
    const start = Date.now()

    function resize() {
      el.width = el.offsetWidth * dpr
      el.height = el.offsetHeight * dpr
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    // Unique bob seeds per node so they move independently
    const seeds: Record<string, number> = {}
    ;[...BASE, ...DIRS, ...DEEP].forEach((n, i) => { seeds[n.id] = i * 1.618 })

    function pos(bx: number, by: number, id: string, t: number, W: number, H: number) {
      const s = seeds[id] ?? 0
      return {
        x: bx * W + Math.sin(t * 0.6 + s) * 4,
        y: by * H + Math.cos(t * 0.5 + s * 0.9) * 4,
      }
    }

    function draw() {
      const W = el.offsetWidth
      const H = el.offsetHeight
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const elapsed = (Date.now() - start) % CYCLE
      const t = Date.now() / 1000

      // --- Opacity schedules ---

      // Prunable cluster + papers: 1 → 0.12 (during prune), then hold gray
      const pruneAlpha = (() => {
        if (elapsed < 8000) return 1
        if (elapsed < 11000) return lerp(1, 0.12, ease((elapsed - 8000) / 3000))
        if (elapsed < 22000) return 0.12
        return lerp(0.12, 1, ease((elapsed - 22000) / 2000))
      })()

      // Pruned cluster stroke color transitions blue → red → gray
      const pruneRGB = (() => {
        if (elapsed < 8000) return [96, 165, 250]
        if (elapsed < 9500) {
          const f = ease((elapsed - 8000) / 1500)
          return [lerp(96, 239, f), lerp(165, 68, f), lerp(250, 68, f)]
        }
        if (elapsed < 12000) return [239, 68, 68]
        if (elapsed < 14000) {
          const f = ease((elapsed - 12000) / 2000)
          return [lerp(239, 148, f), lerp(68, 163, f), lerp(68, 184, f)]
        }
        return [148, 163, 184]
      })()

      // Direction nodes: fade in at 13s, out at 20s
      const dirAlpha = (() => {
        if (elapsed < 13000) return 0
        if (elapsed < 15000) return lerp(0, 1, ease((elapsed - 13000) / 2000))
        if (elapsed < 20000) return 1
        if (elapsed < 22000) return lerp(1, 0, ease((elapsed - 20000) / 2000))
        return 0
      })()

      // Direction node pulse (subtle scale oscillation when visible)
      const dirPulse = dirAlpha > 0 ? 1 + Math.sin(t * 2.5) * 0.08 : 1

      // Go-deeper papers: fade in at 18s, out at 23s
      const deepAlpha = (() => {
        if (elapsed < 18000) return 0
        if (elapsed < 20000) return lerp(0, 1, ease((elapsed - 18000) / 2000))
        if (elapsed < 23000) return 1
        if (elapsed < 24000) return lerp(1, 0, ease((elapsed - 23000) / 1000))
        return 0
      })()

      // --- Edges ---

      ctx.lineWidth = 0.6

      // Paper-to-cluster edges
      for (const n of BASE) {
        if (n.t !== 'paper' && n.t !== 'outlier') continue
        const cluster = BASE.find(c => c.id === n.cl)
        if (!cluster) continue
        const np = pos(n.bx, n.by, n.id, t, W, H)
        const cp = pos(cluster.bx, cluster.by, cluster.id, t, W, H)
        const a = n.prune ? pruneAlpha * 0.4 : 0.18
        ctx.strokeStyle = `rgba(148,163,184,${a})`
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(np.x, np.y)
        ctx.lineTo(cp.x, cp.y)
        ctx.stroke()
      }

      // Outlier edge (weak, dashed)
      const outlier = BASE.find(n => n.t === 'outlier')
      const c4 = BASE.find(n => n.id === 'c4')
      if (outlier && c4) {
        const op = pos(outlier.bx, outlier.by, outlier.id, t, W, H)
        const cp = pos(c4.bx, c4.by, c4.id, t, W, H)
        ctx.setLineDash([3, 5])
        ctx.strokeStyle = 'rgba(251,146,60,0.18)'
        ctx.beginPath()
        ctx.moveTo(op.x, op.y)
        ctx.lineTo(cp.x, cp.y)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Direction edges (dashed purple, from c1)
      if (dirAlpha > 0) {
        const c1 = BASE.find(n => n.id === 'c1')!
        const c1p = pos(c1.bx, c1.by, c1.id, t, W, H)
        ctx.setLineDash([4, 4])
        ctx.lineWidth = 1
        for (const d of DIRS) {
          const dp = pos(d.bx, d.by, d.id, t, W, H)
          ctx.strokeStyle = `rgba(168,85,247,${dirAlpha * 0.45})`
          ctx.beginPath()
          ctx.moveTo(c1p.x, c1p.y)
          ctx.lineTo(dp.x, dp.y)
          ctx.stroke()
        }
        ctx.setLineDash([])
      }

      // Deep edges (new papers linked to c2)
      if (deepAlpha > 0) {
        const c2 = BASE.find(n => n.id === 'c2')!
        const c2p = pos(c2.bx, c2.by, c2.id, t, W, H)
        ctx.lineWidth = 0.6
        for (const d of DEEP) {
          const dp = pos(d.bx, d.by, d.id, t, W, H)
          ctx.strokeStyle = `rgba(96,165,250,${deepAlpha * 0.25})`
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.moveTo(c2p.x, c2p.y)
          ctx.lineTo(dp.x, dp.y)
          ctx.stroke()
        }
      }

      // --- Nodes ---

      for (const n of BASE) {
        const { x, y } = pos(n.bx, n.by, n.id, t, W, H)
        const a = n.prune ? pruneAlpha : 1

        if (n.t === 'cluster') {
          const [r, g, b] = n.prune ? pruneRGB : [96, 165, 250]
          ctx.beginPath()
          ctx.arc(x, y, n.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.14})`
          ctx.fill()
          ctx.strokeStyle = `rgba(${r},${g},${b},${a * 0.65})`
          ctx.lineWidth = 1.5
          ctx.stroke()
        } else if (n.t === 'paper') {
          ctx.beginPath()
          ctx.arc(x, y, n.r, 0, Math.PI * 2)
          ctx.fillStyle = n.prune
            ? `rgba(148,163,184,${a * 0.45})`
            : 'rgba(148,163,184,0.65)'
          ctx.fill()
        } else if (n.t === 'outlier') {
          ctx.beginPath()
          ctx.arc(x, y, n.r, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(251,146,60,0.65)'
          ctx.lineWidth = 1.5
          ctx.stroke()
          ctx.fillStyle = 'rgba(251,146,60,0.08)'
          ctx.fill()
        }
      }

      // Direction nodes (hexagons)
      if (dirAlpha > 0) {
        for (const d of DIRS) {
          const { x, y } = pos(d.bx, d.by, d.id, t, W, H)
          const pr = d.r * dirPulse
          hexPath(ctx, x, y, pr)
          ctx.fillStyle = `rgba(168,85,247,${dirAlpha * 0.14})`
          ctx.fill()
          ctx.strokeStyle = `rgba(168,85,247,${dirAlpha * 0.7})`
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }

      // Go-deeper new paper nodes
      if (deepAlpha > 0) {
        for (const d of DEEP) {
          const { x, y } = pos(d.bx, d.by, d.id, t, W, H)
          ctx.beginPath()
          ctx.arc(x, y, d.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(96,165,250,${deepAlpha * 0.65})`
          ctx.fill()
          // Glow ring for "new node" effect
          ctx.strokeStyle = `rgba(96,165,250,${deepAlpha * 0.35})`
          ctx.lineWidth = 3
          ctx.stroke()
        }
      }
    }

    function loop() {
      draw()
      raf = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none', opacity: 0.38 }}
    />
  )
}
