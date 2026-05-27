'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, X, ExternalLink, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { GraphNode, ClusterNode, DirectionNode } from '@/lib/types'
import type { GraphData } from '@/lib/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
  action?: {
    type: 'suggest_reframe'
    newTopic: string
    reason: string
  } | null
}

interface Props {
  sessionId: string
  seedTopic: string
  graphNodes: GraphNode[]
  selectedNode: GraphNode | null
  prunedClusters: { id: string; label: string; reason: string }[]
  isDark?: boolean
  onDeselect?: () => void
}

function labelFor(node: GraphNode): string {
  if (node.nodeType === 'paper') {
    const t = (node as import('@/lib/types').PaperNode).title
    return t.length > 32 ? t.slice(0, 30) + '…' : t
  }
  if (node.nodeType === 'cluster') return (node as ClusterNode).label
  if (node.nodeType === 'direction') {
    const t = (node as DirectionNode).title
    return t.length > 32 ? t.slice(0, 30) + '…' : t
  }
  if (node.nodeType === 'outlier') {
    const t = (node as import('@/lib/types').OutlierNode).title
    return 'Outlier: ' + (t.length > 24 ? t.slice(0, 22) + '…' : t)
  }
  return 'item'
}

export default function ChatBar({
  sessionId,
  seedTopic,
  graphNodes,
  selectedNode,
  prunedClusters,
  onDeselect,
}: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [navigating, setNavigating] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const hasMessages = messages.length > 0

  const clusterCount = graphNodes.filter((n) => n.nodeType === 'cluster').length
  const paperCount = graphNodes.filter((n) => n.nodeType === 'paper').length

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  async function send() {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, { role: 'user', content: trimmed }])
    setInput('')
    setLoading(true)

    const clusters = graphNodes
      .filter((n): n is ClusterNode => n.nodeType === 'cluster')
      .map(c => ({ id: c.id, label: c.label, description: c.description, paperCount: c.paperCount }))

    const directions = graphNodes
      .filter((n): n is DirectionNode => n.nodeType === 'direction')
      .map(d => ({ title: d.title, description: d.description }))

    const byokKey = typeof window !== 'undefined'
      ? sessionStorage.getItem('nexus_anthropic_key') ?? ''
      : ''

    function nodeContextFor(node: typeof selectedNode) {
      if (!node) return null
      if (node.nodeType === 'paper') {
        const p = node as import('@/lib/types').PaperNode
        return { nodeType: 'paper', title: p.title, year: p.year, authors: p.authors, tldr: p.tldr, abstract: p.abstract?.slice(0, 600), citationCount: p.citationCount, clusterId: p.clusterId }
      }
      if (node.nodeType === 'cluster') {
        const c = node as ClusterNode
        return { nodeType: 'cluster', label: c.label, description: c.description, paperCount: c.paperCount, medianYear: c.medianYear, clusterQuality: c.clusterQuality }
      }
      if (node.nodeType === 'direction') {
        const d = node as import('@/lib/types').DirectionNode
        return { nodeType: 'direction', title: d.title, description: d.description, rationale: d.rationale, noveltyScore: d.noveltyScore, feasibilityScore: d.feasibilityScore, suggestedNextSteps: d.suggestedNextSteps }
      }
      if (node.nodeType === 'outlier') {
        const o = node as import('@/lib/types').OutlierNode
        return { nodeType: 'outlier', title: o.title, year: o.year, authors: o.authors, citationCount: o.citationCount, mahalanobisDistance: o.mahalanobisDistance, outlierExplanation: o.outlierExplanation, bridgePotential: o.bridgePotential }
      }
      return null
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(byokKey ? { 'x-anthropic-key': byokKey } : {}),
        },
        body: JSON.stringify({
          message: trimmed,
          sessionId,
          context: {
            seedTopic,
            clusters,
            selectedNode: nodeContextFor(selectedNode) ?? {
              nodeType: 'session',
              seedTopic,
              clusterCount,
              paperCount,
              label: seedTopic,
              clusterLabels: clusters.map(c => c.label),
            },
            prunedClusters: prunedClusters.map(p => ({ label: p.label, reason: p.reason })),
            directions,
          },
          history,
        }),
      })
      const data = await res.json()
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.text ?? 'No response.', action: data.action ?? null },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong — try again.', action: null },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function handleReframe(newTopic: string) {
    if (navigating) return
    setNavigating(newTopic)
    try {
      const res = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedTopic: newTopic }),
      })
      const data = await res.json()
      if (!res.ok || !data.sessionId) { setNavigating(null); return }
      sessionStorage.setItem(`nexus_graph_${data.sessionId}`, JSON.stringify(data.graph as GraphData))
      sessionStorage.setItem(`nexus_seed_${data.sessionId}`, newTopic)
      router.push(`/session/${data.sessionId}`)
    } catch {
      setNavigating(null)
    }
  }

  return (
    <div className="shrink-0 flex flex-col border-t border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900">
      {/* Message panel — expands upward when messages exist */}
      <div
        className="flex flex-col overflow-hidden"
        style={{
          maxHeight: hasMessages ? '44vh' : 0,
          transition: 'max-height 0.3s ease-in-out',
        }}
      >
        {/* Panel header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Research assistant</span>
          <button
            onClick={() => { setMessages([]); setInput('') }}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
            title="Clear chat"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable messages */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3"
        >
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[82%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                {msg.content}
                {msg.role === 'assistant' && msg.action?.type === 'suggest_reframe' && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-slate-500 dark:text-slate-400 mb-1.5 text-[11px]">{msg.action.reason}</p>
                    <button
                      onClick={() => handleReframe(msg.action!.newTopic)}
                      className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-500 font-medium transition text-[11px]"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span>Explore &quot;{msg.action.newTopic}&quot;</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5">
                <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        {/* Context indicator */}
        {selectedNode ? (
          <div className="flex items-center gap-1 shrink-0 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-full px-2.5 py-0.5 text-[11px] text-blue-700 dark:text-blue-300 max-w-[200px]">
            <span className="truncate">Discussing: {labelFor(selectedNode)}</span>
            {onDeselect && (
              <button
                onClick={onDeselect}
                className="shrink-0 ml-0.5 text-blue-400 hover:text-blue-700 dark:hover:text-blue-200 transition leading-none"
                title="Clear selection"
              >×</button>
            )}
          </div>
        ) : (
          <div className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[180px] hidden sm:block select-none">
            {navigating ? (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Creating session…
              </span>
            ) : (
              'Discussing: full research map'
            )}
          </div>
        )}

        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={selectedNode ? `Ask about ${labelFor(selectedNode)}…` : 'Ask about your research map…'}
          disabled={loading || !!navigating}
          className="flex-1 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 disabled:opacity-60"
        />

        <button
          onClick={send}
          disabled={!input.trim() || loading || !!navigating}
          className="shrink-0 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition"
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}
