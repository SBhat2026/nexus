'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp, Trash2, Pencil, Loader2 } from 'lucide-react'
import SignInModal from '@/components/SignInModal'
import type { GraphNode } from '@/lib/types'

interface NoteRow {
  id: string
  target_id: string
  target_type: string
  note: string | null
  metadata: { node_title?: string; node_type?: string; note?: string } | null
  created_at: string
}

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface Props {
  sessionId: string
  selectedNode: GraphNode
  isLoggedIn: boolean
}

export default function NotesPanel({ sessionId, selectedNode, isLoggedIn }: Props) {
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [notesOpen, setNotesOpen] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [loadingNotes, setLoadingNotes] = useState(false)

  const nodeTitle =
    (selectedNode as { title?: string; label?: string }).title ??
    (selectedNode as { title?: string; label?: string }).label ??
    selectedNode.id

  const fetchNotes = useCallback(async () => {
    setLoadingNotes(true)
    try {
      const res = await fetch(`/api/session/${sessionId}/context`)
      if (!res.ok) return
      const data = await res.json()
      // Filter to this node's notes
      setNotes((data.notes ?? []).filter((n: NoteRow) => n.target_id === selectedNode.id))
    } catch {} finally {
      setLoadingNotes(false)
    }
  }, [sessionId, selectedNode.id])

  useEffect(() => {
    if (isLoggedIn) fetchNotes()
  }, [fetchNotes, isLoggedIn, selectedNode.id])

  async function handleSaveNote() {
    if (!noteText.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/session/${sessionId}/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: selectedNode.id,
          nodeType: selectedNode.nodeType,
          nodeTitle,
          note: noteText.trim(),
        }),
      })
      if (res.ok) {
        setNoteText('')
        setAddOpen(false)
        await fetchNotes()
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(actionId: string) {
    try {
      await fetch(`/api/session/${sessionId}/context/${actionId}`, { method: 'DELETE' })
      setNotes((prev) => prev.filter((n) => n.id !== actionId))
    } catch {}
  }

  return (
    <div className="mt-4 border-t border-slate-200 dark:border-slate-700/60 pt-4">
      {showSignIn && (
        <SignInModal
          title="Sign in to save notes"
          description="Create a free account to attach notes to nodes and build a research log."
          onClose={() => setShowSignIn(false)}
        />
      )}

      {/* Add Note */}
      {!addOpen ? (
        <button
          onClick={() => {
            if (!isLoggedIn) { setShowSignIn(true); return }
            setAddOpen(true)
          }}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition"
        >
          <Pencil className="w-3.5 h-3.5" /> Save Note
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            autoFocus
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note…"
            rows={3}
            className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 p-2 resize-none outline-none focus:border-blue-400 transition"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveNote}
              disabled={!noteText.trim() || submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition"
            >
              {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Confirm
            </button>
            <button
              onClick={() => { setAddOpen(false); setNoteText('') }}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Notes list — only shown when signed in */}
      {isLoggedIn && (
        <div className="mt-3">
          <button
            onClick={() => setNotesOpen((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition w-full"
          >
            {notesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Your Notes {notes.length > 0 ? `(${notes.length})` : ''}
            {loadingNotes && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
          </button>

          {notesOpen && notes.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              {notes.map((n) => (
                <div key={n.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2.5 text-xs flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-700 dark:text-slate-200 leading-relaxed flex-1">
                      {n.note ?? n.metadata?.note ?? ''}
                    </span>
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="shrink-0 text-slate-300 hover:text-red-400 dark:hover:text-red-400 transition mt-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-slate-400 dark:text-slate-500">{relativeTime(n.created_at)}</span>
                </div>
              ))}
            </div>
          )}

          {notesOpen && !loadingNotes && notes.length === 0 && (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">No notes yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
