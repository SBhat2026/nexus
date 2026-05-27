import type { LogEntry } from '@/lib/types'

// Stub: currently a no-op. When human_actions DB writes are wired up,
// insert here — but do NOT call this for focus-mode actions.
export async function logAction(_entry: Omit<LogEntry, 'id' | 'timestamp'>): Promise<void> {
  // future: write to human_actions table
}
