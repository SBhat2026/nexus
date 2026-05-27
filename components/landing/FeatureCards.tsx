import { Layers, Lightbulb, Compass } from 'lucide-react'

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
        <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 flex flex-col gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <Icon className="w-4.5 h-4.5 text-blue-600" />
          </div>
          <p className="text-sm font-semibold text-slate-800 leading-snug">
            {headline} <span className="text-slate-500 font-normal">{sub}</span>
          </p>
        </div>
      ))}
    </div>
  )
}
