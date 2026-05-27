'use client'

import LoadingGraph from './LoadingGraph'
import NexusLogo from '@/components/NexusLogo'

interface Props {
  topic: string
}

export default function LoadingState({ topic }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-[#020817] px-6 overflow-hidden">
      <LoadingGraph />

      <div className="relative z-10 flex flex-col items-center">
        <div className="flex items-center gap-3 mb-8">
          <NexusLogo size={44} />
          <span className="text-xl font-semibold text-slate-800 dark:text-slate-100">Nexus</span>
        </div>

        <div className="relative w-14 h-14 mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-700" />
          <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>

        <p className="text-slate-400 dark:text-slate-600 text-sm italic">{topic}</p>
      </div>
    </div>
  )
}
