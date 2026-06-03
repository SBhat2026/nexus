'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface Ancestor {
  sessionId: string
  seedTopic: string
  depth: number
  clusterLabel: string | null
}

function truncate(s: string, n = 28): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

/**
 * Breadcrumb trail for drill-down sessions: root › … › current. Renders nothing
 * on a root session (chain length ≤ 1). Ancestors link back to their session;
 * the current (rightmost) entry is non-clickable. On mobile only the immediate
 * parent and current are shown.
 */
export default function Breadcrumb({ sessionId }: { sessionId: string }) {
  const [chain, setChain] = useState<Ancestor[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/session/${sessionId}/ancestors`)
      .then((r) => (r.ok ? r.json() : { ancestors: [] }))
      .then((d) => { if (!cancelled) setChain(d.ancestors ?? []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [sessionId])

  if (chain.length <= 1) return null

  const label = (a: Ancestor) => truncate(a.clusterLabel ?? a.seedTopic)

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 max-w-[70vw] overflow-hidden rounded-full bg-white/85 dark:bg-slate-900/85 backdrop-blur px-3 py-1.5 border border-slate-200 dark:border-slate-700/60 shadow-sm text-xs"
    >
      {chain.map((a, i) => {
        const isCurrent = i === chain.length - 1
        const isParent = i === chain.length - 2
        // Mobile: only show immediate parent + current.
        const mobileHidden = !isCurrent && !isParent
        return (
          <span
            key={a.sessionId}
            className={`flex items-center gap-1 shrink-0 ${mobileHidden ? 'hidden sm:flex' : 'flex'}`}
          >
            {i > 0 && <ChevronRight className={`w-3 h-3 text-slate-300 dark:text-slate-600 ${mobileHidden ? 'hidden sm:block' : ''}`} />}
            {isCurrent ? (
              <span className="font-medium text-slate-800 dark:text-slate-100 truncate">{label(a)}</span>
            ) : (
              <Link
                href={`/session/${a.sessionId}`}
                className="text-slate-500 dark:text-slate-400 hover:underline hover:text-slate-800 dark:hover:text-slate-200 transition truncate"
              >
                {label(a)}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
