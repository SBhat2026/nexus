'use client'

import { AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  message?: string
  onRetry: () => void
}

export default function ErrorState({ message, onRetry }: Props) {
  const router = useRouter()

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-[#020817] px-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
            <AlertCircle className="w-6 h-6 text-red-500 dark:text-red-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Couldn&apos;t load this session
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {message ?? 'The session could not be loaded. Your data isn’t lost — retry to reconnect.'}
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition"
          >
            Retry
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium border border-slate-200 dark:border-slate-700 transition"
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  )
}
