'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FlaskConical, AlertCircle } from 'lucide-react'
import type { GraphData } from '@/lib/types'
import SessionProgress from '@/components/landing/SessionProgress'

const EXAMPLES = [
  { label: 'Attention mechanisms in transformers', topic: 'attention mechanisms in transformers' },
  { label: 'CRISPR gene editing mechanisms', topic: 'CRISPR gene editing mechanisms' },
  { label: 'Behavioral economics and decision-making', topic: 'behavioral economics and decision-making' },
]

export default function SeedInput() {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingTopic, setLoadingTopic] = useState('')
  const [loadingSessionId, setLoadingSessionId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const typingCancelRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  function simulateTyping(topic: string) {
    if (typingCancelRef.current) clearTimeout(typingCancelRef.current)
    setTyping(true)
    setValue('')

    let i = 0
    function typeNext() {
      if (i < topic.length) {
        setValue(topic.slice(0, ++i))
        typingCancelRef.current = setTimeout(typeNext, 25)
      } else {
        typingCancelRef.current = setTimeout(() => {
          setTyping(false)
          submit(topic)
        }, 1500)
      }
    }
    typeNext()
  }

  async function submit(topic: string) {
    const trimmed = topic.trim()
    if (!trimmed || loading) return
    setError(null)

    const sessionId = crypto.randomUUID()
    setLoadingTopic(trimmed)
    setLoadingSessionId(sessionId)
    setLoading(true)

    try {
      const res = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedTopic: trimmed, sessionId }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to create session')
        setLoading(false)
        return
      }

      if (!data.sessionId) {
        setError('No papers found for this topic — try a different query.')
        setLoading(false)
        return
      }

      sessionStorage.setItem(`nexus_graph_${data.sessionId}`, JSON.stringify(data.graph as GraphData))
      sessionStorage.setItem(`nexus_seed_${data.sessionId}`, trimmed)
      sessionStorage.setItem(`nexus_ai_available_${data.sessionId}`, String(data.ai_available !== false))
      if (data.ai_reason) sessionStorage.setItem(`nexus_ai_reason_${data.sessionId}`, data.ai_reason)
      router.push(`/session/${data.sessionId}`)
    } catch {
      setError('Network error — please try again.')
      setLoading(false)
    }
  }

  function handleRetry() {
    setLoading(false)
    setLoadingSessionId('')
    setError(null)
  }

  if (loading) {
    return (
      <SessionProgress
        sessionId={loadingSessionId}
        topic={loadingTopic}
        onRetry={handleRetry}
      />
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form
        onSubmit={(e) => { e.preventDefault(); submit(value) }}
        className="flex gap-3 items-start"
      >
        <div className="relative flex-1">
          <Search className="absolute left-5 top-4 text-slate-400 w-5 h-5" />
          <textarea
            rows={2}
            value={value}
            onChange={(e) => {
              if (typing) { if (typingCancelRef.current) clearTimeout(typingCancelRef.current); setTyping(false) }
              setValue(e.target.value); setError(null)
            }}
            onKeyDown={(e) => {
              if (typing) { if (typingCancelRef.current) clearTimeout(typingCancelRef.current); setTyping(false) }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(value) }
            }}
            placeholder="What do you want to learn about?"
            className="w-full pl-14 pr-5 py-4 rounded-3xl bg-white border-2 border-slate-200 text-slate-900 placeholder-slate-400 text-base outline-none focus:border-blue-500 transition shadow-sm resize-none leading-relaxed"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={!value.trim() || loading}
          className="px-7 self-stretch rounded-3xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-base transition shadow-sm flex items-center gap-2"
        >
          <FlaskConical className="w-5 h-5" />
          Explore
        </button>
      </form>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-5">
        <p className="text-slate-400 text-sm mb-3">Try an example:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.topic}
              onClick={() => simulateTyping(ex.topic)}
              disabled={typing || loading}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
