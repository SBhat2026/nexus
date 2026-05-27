import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { searchWorks, oaId } from '@/lib/openalex/client'

export const maxDuration = 30

// Coverage score: rank-weighted citation proxy (heuristic — OpenAlex has no per-result relevance).
// coverage_score in [0, 1]; Low < 0.3, Medium 0.3-0.7, High > 0.7.
function computeCoverage(papers: { rank: number; citationCount: number }[]): number {
  if (!papers.length) return 0
  const maxCite = Math.max(...papers.map((p) => p.citationCount), 1)
  const total = papers.reduce((sum, p) => sum + (1 / p.rank) * (p.citationCount / maxCite), 0)
  const maxPossible = papers.reduce((sum, p) => sum + 1 / p.rank, 0)
  return maxPossible > 0 ? Math.min(total / maxPossible, 1) : 0
}

function coverageLabel(score: number): 'Low' | 'Medium' | 'High' {
  if (score < 0.3) return 'Low'
  if (score < 0.7) return 'Medium'
  return 'High'
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: directionId } = await params
    const db = createServerClient()

    // Load direction
    const { data: dir, error } = await db
      .from('directions')
      .select('id, title, description, session_id')
      .eq('id', directionId)
      .single()

    if (error || !dir) {
      return Response.json({ error: 'Direction not found' }, { status: 404 })
    }

    // Search for related papers via OpenAlex (unconstrained by date — intentional for verification)
    const query = `${dir.title} ${dir.description}`.slice(0, 500)
    const works = await searchWorks(query, 5, { recentRatio: 0 })

    const closest = works.slice(0, 3).map((w) => ({
      title: w.title ?? '',
      year: w.publication_year ?? null,
      citationCount: w.cited_by_count ?? 0,
      url: w.id ? `https://openalex.org/${oaId(w.id)}` : null,
    }))

    const allPapers = works.map((w, i) => ({ rank: i + 1, citationCount: w.cited_by_count ?? 0 }))
    const score = computeCoverage(allPapers)
    const label = coverageLabel(score)
    const closestIds = works.slice(0, 3).map((w) => oaId(w.id))

    // Persist to DB
    await db.from('directions')
      .update({ coverage_score: score, closest_paper_ids: closestIds })
      .eq('id', directionId)

    return Response.json({
      coverageLabel: label,
      coverageScore: score,
      closestPapers: closest,
    })
  } catch (err) {
    console.error('[directions/verify]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
