// Static SVG mock — represents what a real Nexus graph looks like

function hex(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')
}

const CLUSTERS = [
  { cx: 240, cy: 115, r: 30, inner: 13, label: 'Transformer scaling', papers: 14, quality: 0.9 },
  { cx: 100, cy: 270, r: 26, inner: 11, label: 'Sparse attention', papers: 9, quality: 0.75 },
  { cx: 380, cy: 265, r: 26, inner: 11, label: 'Memory mechanisms', papers: 11, quality: 0.82 },
]

const PAPERS = [
  // Around cluster A
  { cx: 165, cy: 75,  r: 7, cite: 1200 },
  { cx: 305, cy: 65,  r: 6, cite: 340  },
  { cx: 195, cy: 155, r: 5, cite: 90   },
  { cx: 295, cy: 155, r: 5, cite: 60   },
  { cx: 240, cy: 55,  r: 8, cite: 3200, rep: true },
  // Around cluster B
  { cx: 50,  cy: 235, r: 6, cite: 450 },
  { cx: 60,  cy: 300, r: 5, cite: 110 },
  { cx: 145, cy: 310, r: 7, cite: 820, rep: true },
  // Around cluster C
  { cx: 320, cy: 295, r: 5, cite: 230 },
  { cx: 445, cy: 240, r: 6, cite: 560 },
  { cx: 460, cy: 310, r: 5, cite: 95  },
  { cx: 390, cy: 320, r: 7, cite: 980, rep: true },
]

const DIRECTIONS = [
  { cx: 440, cy: 95,  label: 'Linear attention',  novelty: 8 },
  { cx: 475, cy: 155, label: 'Subquadratic attn', novelty: 7 },
]

const OUTLIER = { cx: 55, cy: 100, r: 6, label: 'Outlier paper' }

const EDGES = [
  // Cluster-to-cluster
  { x1: 240, y1: 115, x2: 100, y2: 270 },
  { x1: 240, y1: 115, x2: 380, y2: 265 },
  { x1: 100, y1: 270, x2: 380, y2: 265 },
  // Papers to clusters
  { x1: 165, y1: 75,  x2: 240, y2: 115 },
  { x1: 305, y1: 65,  x2: 240, y2: 115 },
  { x1: 240, y1: 55,  x2: 240, y2: 115 },
  { x1: 195, y1: 155, x2: 240, y2: 115 },
  { x1: 295, y1: 155, x2: 240, y2: 115 },
  { x1: 50,  y1: 235, x2: 100, y2: 270 },
  { x1: 60,  y1: 300, x2: 100, y2: 270 },
  { x1: 145, y1: 310, x2: 100, y2: 270 },
  { x1: 320, y1: 295, x2: 380, y2: 265 },
  { x1: 445, y1: 240, x2: 380, y2: 265 },
  { x1: 460, y1: 310, x2: 380, y2: 265 },
  { x1: 390, y1: 320, x2: 380, y2: 265 },
  // Direction edges
  { x1: 440, y1: 95,  x2: 240, y2: 115, amber: true },
  { x1: 475, y1: 155, x2: 380, y2: 265, amber: true },
  // Outlier dashed link
  { x1: 55, y1: 100, x2: 100, y2: 270, dashed: true, orange: true },
]

export default function PreviewGraph({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 530 355"
      className={`w-full h-full ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pgGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>

      {/* Edges */}
      {EDGES.map((e, i) => (
        <line
          key={i}
          x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
          stroke={e.orange ? '#f97316' : e.amber ? '#f59e0b' : '#3b82f6'}
          strokeWidth={e.amber || e.orange ? 1.5 : 1}
          strokeOpacity={e.orange ? 0.5 : e.amber ? 0.5 : 0.18}
          strokeDasharray={e.dashed ? '4 3' : e.amber ? '3 3' : undefined}
        />
      ))}

      {/* Paper nodes */}
      {PAPERS.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={p.r}
          fill="#94a3b8" stroke="#64748b" strokeWidth={1} opacity={0.85} />
      ))}

      {/* Outlier node */}
      <circle cx={OUTLIER.cx} cy={OUTLIER.cy} r={OUTLIER.r}
        fill="#f9731633" stroke="#f97316" strokeWidth={1.5} />
      <text x={OUTLIER.cx + 9} y={OUTLIER.cy + 3} fontSize={8} fill="#f97316" fontWeight="600">
        Outlier
      </text>

      {/* Cluster nodes */}
      {CLUSTERS.map((c, i) => (
        <g key={i}>
          <circle cx={c.cx} cy={c.cy} r={c.r}
            fill="none" stroke="#3b82f6" strokeWidth={1.5}
            strokeOpacity={0.15 + 0.85 * c.quality} />
          <circle cx={c.cx} cy={c.cy} r={c.r - 5}
            fill="#3b82f633" stroke="#3b82f6" strokeWidth={1.5} />
          <circle cx={c.cx} cy={c.cy} r={c.inner}
            fill="url(#pgGrad)" />
          <text x={c.cx} y={c.cy + 4} textAnchor="middle"
            fontSize={9} fontWeight="bold" fill="#1d4ed8">
            {c.papers}
          </text>
          {/* Label */}
          <rect x={c.cx - 48} y={c.cy - c.r - 16} width={96} height={13} rx={3}
            fill="rgba(255,255,255,0.9)" />
          <text x={c.cx} y={c.cy - c.r - 6} textAnchor="middle"
            fontSize={8.5} fontWeight="600" fill="#1e293b">
            {c.label}
          </text>
        </g>
      ))}

      {/* Direction hexagons */}
      {DIRECTIONS.map((d, i) => (
        <g key={i}>
          <polygon points={hex(d.cx, d.cy, 17)}
            fill="#f59e0b33" stroke="#f59e0b" strokeWidth={1.5} />
          <rect x={d.cx - 44} y={d.cy - 28} width={88} height={12} rx={2}
            fill="rgba(255,255,255,0.9)" />
          <text x={d.cx} y={d.cy - 19} textAnchor="middle"
            fontSize={7.5} fontWeight="600" fill="#92400e">
            {d.label}
          </text>
        </g>
      ))}

      {/* Legend */}
      <g transform="translate(12, 12)">
        <rect x={-4} y={-4} width={122} height={68} rx={6}
          fill="rgba(255,255,255,0.92)" stroke="#e2e8f0" strokeWidth={1} />
        {[
          { shape: 'circle', fill: '#3b82f633', stroke: '#3b82f6', label: 'Cluster' },
          { shape: 'circle', fill: '#94a3b8', stroke: '#64748b', label: 'Paper' },
          { shape: 'hex',    fill: '#f59e0b33', stroke: '#f59e0b', label: 'Direction' },
          { shape: 'circle', fill: '#f9731633', stroke: '#f97316', label: 'Outlier' },
        ].map((item, i) => (
          <g key={i} transform={`translate(10, ${i * 15 + 6})`}>
            {item.shape === 'circle'
              ? <circle r={5} fill={item.fill} stroke={item.stroke} strokeWidth={1.2} />
              : <polygon points={hex(0, 0, 6)} fill={item.fill} stroke={item.stroke} strokeWidth={1.2} />}
            <text x={12} y={4} fontSize={8.5} fill="#475569">{item.label}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}
