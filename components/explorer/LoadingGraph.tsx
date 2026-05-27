'use client'

import { useEffect, useRef } from 'react'

// 12s cycle: papers scatter → form clusters → prune one → directions appear → reset
const CYCLE = 12000
const P_FORM = 3000    // 0–3s: papers coalesce into clusters
const P_STABLE = 5000  // 3–5s: stable
const P_PRUNE = 7500   // 5–7.5s: cluster 2 pruned
const P_DIRS = 10000   // 7.5–10s: direction nodes appear from cluster 1
// 10–12s: fade out, reset

// Cluster centers (fraction of canvas)
const CLUSTERS = [
  { id: 'c1', bx: 0.30, by: 0.44, r: 20, prune: false },
  { id: 'c2', bx: 0.68, by: 0.44, r: 22, prune: true },
]

// Papers: bx/by = final position, sx/sy = scatter start position
const PAPERS = [
  // c1
  { id: 'p1a', cl: 'c1', bx: 0.20, by: 0.35, sx: 0.05, sy: 0.20, r: 5 },
  { id: 'p1b', cl: 'c1', bx: 0.22, by: 0.52, sx: 0.08, sy: 0.72, r: 6 },
  { id: 'p1c', cl: 'c1', bx: 0.38, by: 0.34, sx: 0.55, sy: 0.08, r: 4 },
  { id: 'p1d', cl: 'c1', bx: 0.39, by: 0.53, sx: 0.50, sy: 0.88, r: 5 },
  { id: 'p1e', cl: 'c1', bx: 0.15, by: 0.44, sx: 0.02, sy: 0.50, r: 4 },
  // c2
  { id: 'p2a', cl: 'c2', bx: 0.58, by: 0.34, sx: 0.92, sy: 0.15, r: 5 },
  { id: 'p2b', cl: 'c2', bx: 0.59, by: 0.52, sx: 0.88, sy: 0.82, r: 6 },
  { id: 'p2c', cl: 'c2', bx: 0.76, by: 0.34, sx: 0.97, sy: 0.30, r: 4 },
  { id: 'p2d', cl: 'c2', bx: 0.77, by: 0.53, sx: 0.94, sy: 0.68, r: 5 },
  { id: 'p2e', cl: 'c2', bx: 0.66, by: 0.30, sx: 0.62, sy: 0.06, r: 4 },
  { id: 'p2f', cl: 'c2', bx: 0.80, by: 0.45, sx: 0.98, sy: 0.48, r: 5 },
] as const

// Direction nodes (from c1)
const DIRS = [
  { id: 'd1', bx: 0.16, by: 0.60, r: 12 },
  { id: 'd2', bx: 0.42, by: 0.26, r: 12 },
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

export default function LoadingGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const el = canvas
    const ctx = el.getContext('2d')!
    let raf = 0
    const dpr = window.devicePixelRatio || 1
    const start = Date.now()
    const seeds: Record<string, number> = {}
    ;[...PAPERS, ...DIRS].forEach((n, i) => { seeds[n.id] = i * 1.618 })

    function resize() {
      el.width = el.offsetWidth * dpr
      el.height = el.offsetHeight * dpr
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    function bob(id: string, t: number, scale = 3) {
      const s = seeds[id] ?? 0
      return { dx: Math.sin(t * 0.6 + s) * scale, dy: Math.cos(t * 0.5 + s * 0.9) * scale }
    }

    function draw() {
      const W = el.offsetWidth
      const H = el.offsetHeight
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const elapsed = (Date.now() - start) % CYCLE
      const t = Date.now() / 1000

      // Formation progress: 0 = fully scattered, 1 = fully formed
      const formT = elapsed < P_FORM
        ? ease(elapsed / P_FORM)
        : 1

      // Prune alpha for c2 and its papers
      const pruneAlpha = (() => {
        if (elapsed < P_STABLE) return 1
        if (elapsed < P_PRUNE) return lerp(1, 0.10, ease((elapsed - P_STABLE) / (P_PRUNE - P_STABLE)))
        if (elapsed < P_DIRS) return 0.10
        if (elapsed < CYCLE) return lerp(0.10, 1, ease((elapsed - P_DIRS) / (CYCLE - P_DIRS)))
        return 1
      })()

      // Prune stroke: blue → red → slate
      const pruneRGB = (() => {
        if (elapsed < P_STABLE) return [96, 165, 250]
        if (elapsed < P_STABLE + 1200) {
          const f = ease((elapsed - P_STABLE) / 1200)
          return [lerp(96, 239, f), lerp(165, 68, f), lerp(250, 68, f)]
        }
        if (elapsed < P_PRUNE) return [239, 68, 68]
        return [148, 163, 184]
      })()

      // Direction alpha
      const dirAlpha = (() => {
        if (elapsed < P_PRUNE) return 0
        if (elapsed < P_DIRS) return lerp(0, 1, ease((elapsed - P_PRUNE) / (P_DIRS - P_PRUNE)))
        if (elapsed < CYCLE - 1000) return 1
        return lerp(1, 0, ease((elapsed - (CYCLE - 1000)) / 1000))
      })()

      const dirPulse = dirAlpha > 0 ? 1 + Math.sin(t * 2.5) * 0.07 : 1

      // --- Compute node positions ---
      function paperPos(p: typeof PAPERS[number]) {
        const { dx, dy } = bob(p.id, t, 2.5)
        const cx = lerp(p.sx * W, p.bx * W, formT) + dx
        const cy = lerp(p.sy * H, p.by * H, formT) + dy
        return { x: cx, y: cy }
      }

      function clusterPos(c: typeof CLUSTERS[number]) {
        const { dx, dy } = bob(c.id, t, 2)
        return { x: c.bx * W + dx, y: c.by * H + dy }
      }

      // --- Edges ---
      ctx.lineWidth = 1.2

      for (const p of PAPERS) {
        const cl = CLUSTERS.find(c => c.id === p.cl)!
        const pp = paperPos(p)
        const cp = clusterPos(cl)
        const alpha = cl.prune ? pruneAlpha * 0.6 : 0.40
        const edgeAlpha = lerp(0, alpha, formT)
        if (edgeAlpha < 0.01) continue
        ctx.strokeStyle = `rgba(148,163,184,${edgeAlpha})`
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(pp.x, pp.y)
        ctx.lineTo(cp.x, cp.y)
        ctx.stroke()
      }

      // Direction dashed edges
      if (dirAlpha > 0) {
        const c1 = CLUSTERS[0]
        const c1p = clusterPos(c1)
        ctx.setLineDash([4, 4])
        ctx.lineWidth = 1.5
        for (const d of DIRS) {
          const dp = { x: d.bx * W, y: d.by * H }
          ctx.strokeStyle = `rgba(168,85,247,${dirAlpha * 0.65})`
          ctx.beginPath()
          ctx.moveTo(c1p.x, c1p.y)
          ctx.lineTo(dp.x, dp.y)
          ctx.stroke()
        }
        ctx.setLineDash([])
      }

      // --- Cluster nodes ---
      for (const c of CLUSTERS) {
        const { x, y } = clusterPos(c)
        const clAlpha = c.prune ? pruneAlpha : 1
        const [r, g, b] = c.prune ? pruneRGB : [96, 165, 250]
        const appear = lerp(0, 1, Math.min(1, formT * 1.5))

        ctx.beginPath()
        ctx.arc(x, y, c.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${clAlpha * appear * 0.28})`
        ctx.fill()
        ctx.strokeStyle = `rgba(${r},${g},${b},${clAlpha * appear * 0.88})`
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // --- Paper nodes ---
      for (const p of PAPERS) {
        const cl = CLUSTERS.find(c => c.id === p.cl)!
        const { x, y } = paperPos(p)
        const alpha = cl.prune ? pruneAlpha : 1
        const fillColor = cl.prune
          ? `rgba(148,163,184,${alpha * 0.70})`
          : 'rgba(148,163,184,0.88)'
        ctx.beginPath()
        ctx.arc(x, y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = fillColor
        ctx.fill()
      }

      // --- Direction hexagons ---
      if (dirAlpha > 0) {
        for (const d of DIRS) {
          const dp = { x: d.bx * W, y: d.by * H }
          const pr = d.r * dirPulse
          hexPath(ctx, dp.x, dp.y, pr)
          ctx.fillStyle = `rgba(168,85,247,${dirAlpha * 0.28})`
          ctx.fill()
          ctx.strokeStyle = `rgba(168,85,247,${dirAlpha * 0.92})`
          ctx.lineWidth = 2
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
      style={{ pointerEvents: 'none', opacity: 0.80 }}
    />
  )
}
