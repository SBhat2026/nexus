import Link from 'next/link'
import { ArrowLeft, Zap, Flag } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'

interface Direction {
  id: string
  title: string
  description: string | null
  rationale: string | null
  novelty_score: number | null
  feasibility_score: number | null
  suggested_next_steps: string[] | null
  is_flagged: boolean
  human_rating: number | null
  parent_cluster_id: string | null
  clusters?: { label: string } | null
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${value * 10}%` }} />
      </div>
      <span className="text-slate-400 w-5 text-right">{value}</span>
    </div>
  )
}

export default async function DirectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServerClient()

  const { data: directions } = await db
    .from('directions')
    .select('*, clusters(label)')
    .eq('session_id', id)
    .order('created_at', { ascending: true })

  const rows = (directions ?? []) as Direction[]

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link href={`/session/${id}`} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm mb-8 transition">
        <ArrowLeft className="w-4 h-4" /> Back to Explorer
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <Zap className="w-5 h-5 text-amber-400" />
        <h1 className="text-2xl font-bold text-slate-100">Research Directions</h1>
        <span className="text-sm text-slate-500">{rows.length} generated</span>
      </div>

      {rows.length === 0 ? (
        <div className="text-slate-400 text-sm bg-slate-900 border border-slate-700 rounded-xl p-8 text-center">
          No directions yet. Go back to the Explorer, click a cluster, and press &ldquo;Generate directions&rdquo;.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((d) => (
            <div key={d.id} className="bg-slate-900 border border-slate-700/60 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100 leading-snug">{d.title}</h2>
                  {d.clusters?.label && (
                    <div className="text-xs text-slate-500 mt-0.5">From cluster: {d.clusters.label}</div>
                  )}
                </div>
                {d.is_flagged && <Flag className="w-4 h-4 text-amber-400 shrink-0" />}
              </div>

              {d.description && (
                <p className="text-xs text-slate-300 leading-relaxed">{d.description}</p>
              )}

              <div className="space-y-1.5">
                {d.novelty_score != null && (
                  <ScoreBar label="Novelty" value={d.novelty_score} color="bg-blue-500" />
                )}
                {d.feasibility_score != null && (
                  <ScoreBar label="Feasibility" value={d.feasibility_score} color="bg-green-500" />
                )}
              </div>

              {d.rationale && (
                <details className="text-xs text-slate-400 group">
                  <summary className="cursor-pointer text-slate-500 hover:text-slate-300 transition list-none flex items-center gap-1">
                    <span className="group-open:rotate-90 inline-block transition-transform">›</span> Rationale
                  </summary>
                  <p className="mt-2 leading-relaxed pl-3 border-l border-slate-700">{d.rationale}</p>
                </details>
              )}

              {d.suggested_next_steps && d.suggested_next_steps.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 mb-1.5">Next steps</div>
                  <ul className="space-y-1">
                    {d.suggested_next_steps.map((s, i) => (
                      <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                        <span className="text-slate-600 mt-0.5 shrink-0">›</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
