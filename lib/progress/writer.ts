import { createServerClient } from '@/lib/supabase/server'

export type ProgressStage =
  | 'fetching'
  | 'embedding'
  | 'clustering'
  | 'saving'
  | 'labeling'
  | 'ready'
  | 'error'

const STAGE_INDEX: Record<ProgressStage, number> = {
  fetching: 1,
  embedding: 2,
  clustering: 3,
  saving: 4,
  labeling: 5,
  ready: 6,
  error: -1,
}

export async function writeProgress(
  sessionId: string,
  stage: ProgressStage,
  detail?: string,
  error?: string,
): Promise<void> {
  try {
    const db = createServerClient()
    await db.from('session_progress').upsert(
      {
        session_id: sessionId,
        stage,
        stage_index: STAGE_INDEX[stage],
        stage_total: 6,
        detail: detail ?? null,
        error: error ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id' },
    )
  } catch {
    // swallow — never fail the pipeline for a progress write
  }
}
