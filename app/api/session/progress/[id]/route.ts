import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = createServerClient()
  const { data } = await db
    .from('session_progress')
    .select('stage, stage_index, stage_total, detail, error, updated_at')
    .eq('session_id', id)
    .single()

  if (!data) {
    return Response.json({ stage: 'pending', stageIndex: 0, stageTotal: 6, detail: 'Starting…' })
  }

  return Response.json({
    stage: data.stage,
    stageIndex: data.stage_index,
    stageTotal: data.stage_total,
    detail: data.detail,
    error: data.error,
    updatedAt: data.updated_at,
  })
}
