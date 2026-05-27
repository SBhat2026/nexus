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
  { key: 'fetching',   label: 'Fetching papers',       icon: '🔍' },
  { key: 'embedding',  label: 'Computing embeddings',  icon: '🧮' },
  { key: 'clustering', label: 'Clustering',            icon: '🗂' },
  { key: 'saving',     label: 'Saving to database',    icon: '💾' },
  { key: 'labeling',   label: 'AI labeling',           icon: '✨' },
  { key: 'ready',      label: 'Ready',                 icon: '✓'  },
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
        // ignore transient errors — keep polling
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
  const pct = Math.round((progress.stageIndex / progress.stageTotal) * 100)

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-[#020817] px-6 overflow-hidden">
      <LoadingGraph />

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <NexusLogo size={44} />
          <span className="text-xl font-semibold text-slate-800 dark:text-slate-100">Nexus</span>
        </div>

        {/* Topic */}
        <p className="text-slate-400 dark:text-slate-500 text-sm italic mb-8 text-center line-clamp-2">{topic}</p>

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
          <>
            {/* Linear progress bar */}
            <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full mb-6 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Stage list */}
            <ol className="w-full space-y-2">
              {STAGES.map((s, i) => {
                const stepNum = i + 1
                const isDone = progress.stageIndex > stepNum ||
                  (progress.stageIndex === stepNum && progress.stage === 'ready')
                const isActive = progress.stage === s.key

                return (
                  <li
                    key={s.key}
                    className={`flex items-start gap-3 transition-opacity duration-300 ${
                      isDone ? 'opacity-40' : isActive ? 'opacity-100' : 'opacity-30'
                    }`}
                  >
                    {/* Step indicator */}
                    <span className="mt-0.5 w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-[11px]
                      border transition-all duration-300
                      ${isDone
                        ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                        : isActive
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400'
                      }">
                      {isDone ? '✓' : isActive ? <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" /> : stepNum}
                    </span>

                    <div className="flex-1 min-w-0 pt-0.5">
                      <span className={`text-sm ${isActive ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                        {s.label}
                      </span>
                      {isActive && progress.detail && (
                        <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5 font-mono">{progress.detail}</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  )
}
