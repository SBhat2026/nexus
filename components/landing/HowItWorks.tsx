import { Search, Network, Compass } from 'lucide-react'

const STEPS = [
  {
    Icon: Search,
    text: 'Enter a topic or paste a paper title',
  },
  {
    Icon: Network,
    text: 'Nexus fetches and clusters related work from 250M+ papers',
  },
  {
    Icon: Compass,
    text: 'Explore clusters, flag outliers, and get AI-generated research directions',
  },
]

export default function HowItWorks() {
  return (
    <div className="w-full max-w-3xl mx-auto">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider text-center mb-6">How it works</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {STEPS.map(({ Icon, text }, i) => (
          <div key={i} className="flex flex-col items-center text-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Icon className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
