import type { SupabaseClient } from '@supabase/supabase-js'

// Non-admin users may keep at most this many saved sessions. When the count
// exceeds the cap, the oldest saved sessions are deleted (FIFO). The admin
// (profiles.is_admin = true) is exempt and may save unlimited sessions.
export const SESSION_CAP = 10

interface EnforceOpts {
  // Session ids that must never be deleted even if over cap (e.g. the active
  // lineage during a drill-down: the parent and the freshly-created child).
  exclude?: string[]
}

/**
 * Enforce the saved-session cap for a non-admin user. Keeps the SESSION_CAP most
 * recent saved sessions and deletes the rest (cascades to child rows), skipping
 * any ids in `exclude`. Admins are exempt. Returns the ids that were deleted.
 */
export async function enforceSessionCap(
  db: SupabaseClient,
  userId: string,
  opts: EnforceOpts = {},
): Promise<string[]> {
  const exclude = new Set(opts.exclude ?? [])

  const { data: profile } = await db
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.is_admin) return []

  const { data: saved } = await db
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('is_saved', true)
    .order('created_at', { ascending: false })

  if (!saved || saved.length <= SESSION_CAP) return []

  // Keep the SESSION_CAP most recent; delete the rest, never touching `exclude`.
  const toDelete = saved
    .slice(SESSION_CAP)
    .map((s) => s.id as string)
    .filter((id) => !exclude.has(id))

  if (toDelete.length === 0) return []

  const { error } = await db.from('sessions').delete().in('id', toDelete)
  return error ? [] : toDelete
}
