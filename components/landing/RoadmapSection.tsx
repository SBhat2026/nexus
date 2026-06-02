'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, Sparkles, FlaskConical, ArrowUpRight } from 'lucide-react'
import { ROADMAP, type RoadmapItem, type RoadmapStatus } from '@/lib/roadmap'

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

const STATUS_META: Record<RoadmapStatus, { label: string; Icon: React.ElementType; classes: string; pillClasses: string }> = {
  shipped: {
    label: 'Shipped',
    Icon: CheckCircle2,
    classes: 'text-emerald-600',
    pillClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  'in-progress': {
    label: 'In progress',
    Icon: Loader2,
    classes: 'text-blue-600',
    pillClasses: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  next: {
    label: 'Next',
    Icon: Sparkles,
    classes: 'text-violet-600',
    pillClasses: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  exploring: {
    label: 'Exploring',
    Icon: FlaskConical,
    classes: 'text-slate-500',
    pillClasses: 'bg-slate-50 text-slate-600 border-slate-200',
  },
}

function RoadmapCard({ item, delay }: { item: RoadmapItem; delay: number }) {
  const { ref, progress } = useScrollReveal()
  const meta = STATUS_META[item.status]
  const Icon = meta.Icon

  return (
    <div
      ref={ref}
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * 24}px)`,
        transitionDelay: `${delay}ms`,
      }}
      className="group relative rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-all p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${meta.pillClasses}`}>
          <Icon className={`w-3 h-3 ${item.status === 'in-progress' ? 'animate-spin' : ''}`} />
          {meta.label}
        </span>
        {item.eta && (
          <span className="text-xs text-slate-400 font-medium">{item.eta}</span>
        )}
        {item.shippedAt && (
          <span className="text-xs text-slate-400 font-medium">
            {new Date(item.shippedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900 leading-snug mb-1.5">{item.title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
      </div>

      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-auto pt-2">
          {item.tags.map((tag) => (
            <span key={tag} className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const STATUS_ORDER: RoadmapStatus[] = ['in-progress', 'next', 'exploring', 'shipped']

export default function RoadmapSection() {
  // Show the most relevant 6 items on the landing — 1-2 in-progress, then a few next, sprinkle exploring/shipped
  const ordered = [
    ...ROADMAP.filter((i) => i.status === 'in-progress'),
    ...ROADMAP.filter((i) => i.status === 'next' && i.tier === 1),
    ...ROADMAP.filter((i) => i.status === 'next' && i.tier === 2).slice(0, 1),
    ...ROADMAP.filter((i) => i.status === 'exploring').slice(0, 1),
  ].slice(0, 6)

  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = ROADMAP.filter((i) => i.status === s).length
    return acc
  }, {} as Record<RoadmapStatus, number>)

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Roadmap</p>
          <h2 className="text-2xl font-bold text-slate-900">What&apos;s coming next</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {counts.shipped} shipped
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            {counts['in-progress']} active
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            {counts.next} planned
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ordered.map((item, i) => (
          <RoadmapCard key={item.id} item={item} delay={i * 60} />
        ))}
      </div>

      <div className="flex justify-center mt-8">
        <Link
          href="/roadmap"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition group"
        >
          View full roadmap
          <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  )
}
