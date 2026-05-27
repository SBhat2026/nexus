'use client'

import { useId } from 'react'

interface Props {
  size?: number
  className?: string
}

export default function NexusLogo({ size = 40, className = '' }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gradId = `ng${uid}`
  const glowId = `ngl${uid}`

  // Three cluster nodes matching the app's ring-style cluster visualization
  // Arranged in a triangle: one dominant top node, two smaller below
  const top  = { cx: 50,  cy: 18, r: 13, innerR: 5.5 }
  const bl   = { cx: 17,  cy: 74, r: 10, innerR: 4 }
  const br   = { cx: 83,  cy: 74, r: 10, innerR: 4 }

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="20" y1="5" x2="80" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#93c5fd" />
          <stop offset="50%"  stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Connecting edges — drawn first so cluster rings appear above */}
      <line
        x1={top.cx} y1={top.cy} x2={bl.cx} y2={bl.cy}
        stroke="#3b82f6" strokeWidth="2.2" strokeOpacity="0.45" strokeLinecap="round"
      />
      <line
        x1={top.cx} y1={top.cy} x2={br.cx} y2={br.cy}
        stroke="#3b82f6" strokeWidth="2.2" strokeOpacity="0.45" strokeLinecap="round"
      />
      <line
        x1={bl.cx} y1={bl.cy} x2={br.cx} y2={br.cy}
        stroke="#3b82f6" strokeWidth="1.6" strokeOpacity="0.30" strokeLinecap="round"
      />

      {/* Small paper nodes (representing papers in each cluster) */}
      <circle cx={36} cy={8}  r={2.8} fill="#93c5fd" fillOpacity="0.75" />
      <circle cx={62} cy={9}  r={2.2} fill="#93c5fd" fillOpacity="0.60" />
      <circle cx={5}  cy={60} r={2.4} fill="#3b82f6" fillOpacity="0.55" />
      <circle cx={25} cy={88} r={2.2} fill="#3b82f6" fillOpacity="0.55" />
      <circle cx={90} cy={58} r={2.4} fill="#3b82f6" fillOpacity="0.55" />
      <circle cx={74} cy={88} r={2.2} fill="#3b82f6" fillOpacity="0.55" />

      {/* Paper → cluster edges */}
      <line x1={36} y1={8}  x2={top.cx} y2={top.cy} stroke="#93c5fd" strokeWidth="1.2" strokeOpacity="0.40" />
      <line x1={62} y1={9}  x2={top.cx} y2={top.cy} stroke="#93c5fd" strokeWidth="1.2" strokeOpacity="0.35" />
      <line x1={5}  y1={60} x2={bl.cx}  y2={bl.cy}  stroke="#3b82f6" strokeWidth="1.2" strokeOpacity="0.35" />
      <line x1={25} y1={88} x2={bl.cx}  y2={bl.cy}  stroke="#3b82f6" strokeWidth="1.2" strokeOpacity="0.35" />
      <line x1={90} y1={58} x2={br.cx}  y2={br.cy}  stroke="#3b82f6" strokeWidth="1.2" strokeOpacity="0.35" />
      <line x1={74} y1={88} x2={br.cx}  y2={br.cy}  stroke="#3b82f6" strokeWidth="1.2" strokeOpacity="0.35" />

      {/* Cluster rings (outer stroke + inner filled dot — matches app UI) */}
      {[top, bl, br].map((node, i) => (
        <g key={i} filter={`url(#${glowId})`}>
          <circle
            cx={node.cx} cy={node.cy} r={node.r}
            stroke={`url(#${gradId})`} strokeWidth="2.5"
            fill="white" fillOpacity="0.08"
          />
          <circle
            cx={node.cx} cy={node.cy} r={node.innerR}
            fill={`url(#${gradId})`}
          />
        </g>
      ))}
    </svg>
  )
}
