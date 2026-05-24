'use client'

import { useEffect, useState } from 'react'
import { Network } from 'lucide-react'

const STEPS = [
  'Searching Semantic Scholar…',
  'Fetching paper details…',
  'Retrieving SPECTER2 embeddings…',
  'Running semantic clustering…',
  'Detecting outliers…',
  'Building graph…',
]

interface Props {
  topic: string
}

export default function LoadingState({ topic }: Props) {
  const [stepIdx, setStepIdx] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
    }, 5500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#020817] px-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30">
          <Network className="w-6 h-6 text-blue-400" />
        </div>
        <span className="text-xl font-semibold text-slate-100">Nexus</span>
      </div>

      <div className="relative w-14 h-14 mb-8">
        <div className="absolute inset-0 rounded-full border-2 border-slate-700" />
        <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>

      <div className="text-center mb-6">
        <p className="text-slate-300 text-base font-medium mb-1">{STEPS[stepIdx]}</p>
        <p className="text-slate-600 text-sm">
          Topic: <span className="text-slate-500 italic">{topic}</span>
        </p>
      </div>

      <div className="flex gap-1.5 mb-8">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 w-8 rounded-full transition-all duration-500 ${
              i <= stepIdx ? 'bg-blue-500' : 'bg-slate-700'
            }`}
          />
        ))}
      </div>

      <p className="text-slate-600 text-xs">Typically takes 20–45 seconds</p>
    </div>
  )
}
