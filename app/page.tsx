import Link from 'next/link'
import { Network } from 'lucide-react'
import SeedInput from '@/components/landing/SeedInput'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30">
            <Network className="w-7 h-7 text-blue-400" />
          </div>
          <span className="text-2xl font-semibold tracking-tight text-slate-100">Nexus</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-100 mb-4 leading-tight">
          The Google Maps<br />of research
        </h1>
        <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
          Enter a topic or paper. Nexus maps the surrounding idea-space, clusters
          related work, flags outliers, and surfaces research directions — keeping
          you in control.
        </p>
      </div>

      <SeedInput />

      <div className="mt-20 grid grid-cols-3 gap-6 max-w-2xl w-full text-center">
        {[
          { title: 'Semantic Clusters', desc: 'Papers grouped by conceptual similarity, not just citation links.' },
          { title: 'Outlier Detection', desc: 'Ideas that don\'t fit any cluster — flagged and explained.' },
          { title: 'Research Directions', desc: 'AI-generated hypotheses shaped by your pruning and reframing.' },
        ].map((f) => (
          <div key={f.title} className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <div className="text-sm font-semibold text-blue-400 mb-2">{f.title}</div>
            <div className="text-xs text-slate-400 leading-relaxed">{f.desc}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 text-sm text-slate-600">
        <Link href="/about" className="hover:text-slate-400 transition">About Nexus</Link>
      </div>
    </main>
  )
}
