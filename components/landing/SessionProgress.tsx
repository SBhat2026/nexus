'use client'

import { useEffect, useRef, useState } from 'react'
import NexusLogo from '@/components/NexusLogo'
import LoadingGraph from '@/components/explorer/LoadingGraph'

interface ProgressState {
  stage: string
  stageIndex: number
  stageTotal: number
  detail?: string | null
  error?: string | null
}

const STAGES = [
  { key: 'fetching', label: 'Fetching papers' },
  { key: 'embedding', label: 'Computing embeddings' },
  { key: 'clustering', label: 'Clustering' },
  { key: 'saving', label: 'Saving to database' },
  { key: 'labeling', label: 'AI labeling' },
  { key: 'ready', label: 'Ready' },
]

interface Props {
  sessionId: string
  topic: string
  onRetry: () => void
}

export default function SessionProgress({ sessionId, topic, onRetry }: Props) {
  const [progress, setProgress] = useState<ProgressState>({
    stage: 'pending',
    stageIndex: 0,
    stageTotal: 6,
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let stopped = false

    async function poll() {
      try {
        const res = await fetch(`/api/session/progress/${sessionId}`)
        if (res.ok) {
          const data: ProgressState = await res.json()
          if (!stopped) setProgress(data)
        }
      } catch {
        // ignore transient network errors — keep polling
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 1500)

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (intervalRef.current) clearInterval(intervalRef.current)
      } else {
        poll()
        intervalRef.current = setInterval(poll, 1500)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stopped = true
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [sessionId])

  const isError = progress.stage === 'error'

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-[#020817] px-6 overflow-hidden">
      <LoadingGraph />

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <NexusLogo size={44} />
          <span className="text-xl font-semibold text-slate-800 dark:text-slate-100">Nexus</span>
        </div>

        <p className="text-slate-400 dark:text-slate-500 text-sm italic mb-8 text-center">{topic}</p>

        {isError ? (
          <div className="w-full text-center">
            <p className="text-red-500 text-sm mb-4">{progress.error ?? 'Something went wrong.'}</p>
            <button
              onClick={onRetry}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition"
            >
              Try again
            </button>
          </div>
        ) : (
          <ol className="w-full space-y-3">
            {STAGES.map((s, i) => {
              const stepNum = i + 1
              const isDone = progress.stageIndex >= stepNum && progress.stage !== 'pending'
              const isRunning = progress.stageIndex === stepNum && !isDone
              const isActive = progress.stage === s.key || (isRunning)

              return (
                <li key={s.key} className="flex items-start gap-3">
                  <span className="mt-0.5 w-5 shrink-0 text-center">
                    {isDone ? (
                      <span className="text-blue-500 text-sm">✓</span>
                    ) : isActive ? (
                      <span className="inline-block w-3 h-3 rounded-full bg-blue-500 animate-pulse mt-1" />
                    ) : (
                      <span className="inline-block w-3 h-3 rounded-full border border-slate-300 dark:border-slate-600 mt-1" />
                    )}
                  </span>
                  <div>
                    <span
                      className={`text-sm ${
                        isDone
                          ? 'text-slate-400 dark:text-slate-500'
                          : isActive
                          ? 'text-slate-800 dark:text-slate-100 font-medium'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    >
                      {s.label}
                    </span>
                    {isActive && progress.detail && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{progress.detail}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
