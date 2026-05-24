import Link from 'next/link'
import { ArrowLeft, Zap } from 'lucide-react'

export default async function DirectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link href={`/session/${id}`} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm mb-8 transition">
        <ArrowLeft className="w-4 h-4" /> Back to Explorer
      </Link>
      <div className="flex items-center gap-3 mb-6">
        <Zap className="w-5 h-5 text-amber-400" />
        <h1 className="text-2xl font-bold text-slate-100">Research Directions</h1>
      </div>
      <p className="text-slate-400 text-sm">Generate directions from the Main Explorer to populate this view. (Phase 3)</p>
    </main>
  )
}
