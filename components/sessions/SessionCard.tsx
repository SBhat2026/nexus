'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Loader2 } from 'lucide-react'

interface Props {
  id: string
  seedTopic: string
  date: string
  clusterCount: number
  paperCount: number
  dataSource?: string | null
}

export default function SessionCard({ id, seedTopic, date, clusterCount, paperCount, dataSource }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [, startTransition] = useTransition()

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/session/${id}`, { method: 'DELETE' })
    if (res.ok) {
      startTransition(() => router.refresh())
    } else {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div className="group relative flex items-center gap-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-slate-50 transition">
      <Link href={`/session/${id}`} className="flex flex-1 flex-col gap-1 p-4 min-w-0">
        <span className="font-medium text-slate-900 truncate">{seedTopic}</span>
        <span className="text-xs text-slate-400">
          {date} · {clusterCount} clusters · {paperCount} papers
          {dataSource && dataSource !== 'openalex' && (
            <span className="ml-2 text-slate-300">via {dataSource}</span>
          )}
        </span>
      </Link>

      <div className="pr-3 shrink-0">
        {confirming ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition disabled:opacity-60 inline-flex items-center gap-1"
            >
              {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
              Delete
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="px-2.5 py-1 rounded-md text-slate-500 hover:text-slate-700 text-xs font-medium transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            aria-label="Delete session"
            className="p-2 rounded-md text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
