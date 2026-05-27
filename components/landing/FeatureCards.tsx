'use client'

import { useEffect, useRef, useState } from 'react'
import { Layers, Lightbulb, Compass } from 'lucide-react'

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function update() {
      const el = ref.current
      if (!el) return
      const { top } = el.getBoundingClientRect()
      const vh = window.innerHeight
      const p = (vh * 0.92 - top) / (vh * 0.57)
      setProgress(Math.max(0, Math.min(1, p)))
    }
    window.addEventListener('scroll', update, { passive: true })
    update()
    return () => window.removeEventListener('scroll', update)
  }, [])

  return { ref, progress }
}

function Card({ Icon, headline, sub }: { Icon: React.ElementType; headline: string; sub: string }) {
  const { ref, progress } = useScrollReveal()
  return (
    <div
      ref={ref}
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * 32}px)`,
      }}
      className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 flex flex-col gap-3"
    >
      <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
        <Icon className="w-4.5 h-4.5 text-blue-600" />
      </div>
      <p className="text-sm font-semibold text-slate-800 leading-snug">
        {headline} <span className="text-slate-500 font-normal">{sub}</span>
      </p>
    </div>
  )
}

const CARDS = [
  {
    Icon: Layers,
    headline: 'See how papers group together',
    sub: '— and spot what doesn\'t fit.',
  },
  {
    Icon: Lightbulb,
    headline: 'Get specific hypotheses to pursue',
    sub: 'with novelty and feasibility scores.',
  },
  {
    Icon: Compass,
    headline: 'Find the papers that break the pattern',
    sub: '— often where new ideas live.',
  },
]

export default function FeatureCards() {
  return (
    <div className="w-full max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5">
      {CARDS.map(({ Icon, headline, sub }, i) => (
        <Card key={i} Icon={Icon} headline={headline} sub={sub} />
      ))}
    </div>
  )
}
