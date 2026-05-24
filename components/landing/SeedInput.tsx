'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FlaskConical } from 'lucide-react'

const EXAMPLES = [
  { label: 'Attention mechanisms in transformers', topic: 'attention mechanisms in transformers' },
  { label: 'CRISPR gene editing mechanisms', topic: 'CRISPR gene editing mechanisms' },
  { label: 'Behavioral economics and decision-making', topic: 'behavioral economics and decision-making' },
]

export default function SeedInput() {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function submit(topic: string) {
    const trimmed = topic.trim()
    if (!trimmed) return
    setLoading(true)
    const id = crypto.randomUUID()
    // Store seed topic in sessionStorage so the explorer can read it
    sessionStorage.setItem(`nexus_seed_${id}`, trimmed)
    router.push(`/session/${id}?topic=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form
        onSubmit={(e) => { e.preventDefault(); submit(value) }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter a research topic or paste a paper DOI…"
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-100 placeholder-slate-500 text-base outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
          />
        </div>
        <button
          type="submit"
          disabled={!value.trim() || loading}
          className="px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition flex items-center gap-2"
        >
          <FlaskConical className="w-4 h-4" />
          {loading ? 'Opening…' : 'Explore'}
        </button>
      </form>

      <div className="mt-6">
        <p className="text-slate-500 text-sm mb-3">Example sessions:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.topic}
              onClick={() => submit(ex.topic)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm transition"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
