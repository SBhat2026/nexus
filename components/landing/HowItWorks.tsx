'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Network, Compass } from 'lucide-react'

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function update() {
      const el = ref.current
      if (!el) return
      const { top } = el.getBoundingClientRect()
      const vh = window.innerHeight
      // 0 when element bottom-edge enters viewport; 1 when element top-edge reaches 35% from top
      const p = (vh * 0.92 - top) / (vh * 0.57)
      setProgress(Math.max(0, Math.min(1, p)))
    }
    window.addEventListener('scroll', update, { passive: true })
    update()
    return () => window.removeEventListener('scroll', update)
  }, [])

  return { ref, progress }
}

function Step({ Icon, text }: { Icon: React.ElementType; text: string }) {
  const { ref, progress } = useScrollReveal()
  return (
    <div
      ref={ref}
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * 30}px)`,
      }}
      className="flex flex-col items-center text-center gap-3"
    >
      <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
        <Icon className="w-5 h-5 text-blue-600" />
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
    </div>
  )
}

const STEPS = [
  { Icon: Search, text: 'Enter a topic or paste a paper title' },
  { Icon: Network, text: 'Nexus fetches and clusters related work from 250M+ papers' },
  { Icon: Compass, text: 'Explore clusters, flag outliers, and get AI-generated research directions' },
]

export default function HowItWorks() {
  return (
    <div className="w-full max-w-3xl mx-auto">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider text-center mb-6">How it works</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {STEPS.map(({ Icon, text }, i) => (
          <Step key={i} Icon={Icon} text={text} />
        ))}
      </div>
    </div>
  )
}
