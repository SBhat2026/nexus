import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function AboutPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm mb-10 transition">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <h1 className="text-3xl font-bold text-slate-100 mb-6">About Nexus</h1>

      <div className="prose prose-invert prose-slate max-w-none space-y-5 text-slate-300 leading-relaxed">
        <p>
          Nexus is an AI-powered research navigation tool that helps researchers —
          especially early-career and interdisciplinary researchers — move through
          idea-space more efficiently.
        </p>
        <p>
          It is not an autonomous research agent. It is a structured search
          assistant and dynamic conceptual map: a system that compresses redundant
          idea-space, preserves potentially important outliers, and surfaces
          nonobvious connections across fields — while keeping the human researcher
          in control of direction and judgment.
        </p>
        <h2 className="text-xl font-semibold text-slate-100 mt-8">How to use it</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Enter a seed topic or paper DOI on the home page.</li>
          <li>Nexus fetches related papers and clusters them semantically.</li>
          <li>Prune dead ends, flag outliers, and reframe clusters.</li>
          <li>Click &ldquo;Generate Directions&rdquo; — Claude proposes research hypotheses informed by your annotations.</li>
          <li>Expand any direction to explore further.</li>
        </ol>
        <p className="text-slate-500 text-sm mt-8">Phase 1 — UI &amp; mock data. Live data integration in Phase 2.</p>
      </div>
    </main>
  )
}
