'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Layers, Zap, Download, GitBranch } from 'lucide-react'
import { useSessionStore } from '@/store/useSessionStore'
import type { LayerToggles } from '@/lib/types'

const LAYER_LABELS: { key: keyof LayerToggles; label: string }[] = [
  { key: 'papers', label: 'Paper nodes' },
  { key: 'directions', label: 'Direction nodes' },
  { key: 'outliers', label: 'Outlier nodes' },
  { key: 'pruned', label: 'Pruned clusters' },
  { key: 'citationEdges', label: 'Citation edges' },
  { key: 'semanticEdges', label: 'Semantic edges' },
  { key: 'generatedEdges', label: 'Generated edges' },
]

interface Props {
  onGoDeeper: () => void
  onGenerateDirections: () => void
  onExport: () => void
}

export default function LeftSidebar({ onGoDeeper, onGenerateDirections, onExport }: Props) {
  const { sessionName, setSessionName, seedTopic, depth, setDepth, layerToggles, toggleLayer } = useSessionStore()
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(sessionName)
  const [layersOpen, setLayersOpen] = useState(true)

  function commitName() {
    setSessionName(nameValue || 'Untitled Session')
    setEditingName(false)
  }

  return (
    <aside className="h-full flex flex-col bg-slate-900 border-r border-slate-700/60 overflow-y-auto">
      <div className="p-4 border-b border-slate-700/60">
        {editingName ? (
          <input
            autoFocus
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') commitName() }}
            className="w-full bg-slate-800 text-slate-100 px-2 py-1 rounded text-sm border border-slate-600 outline-none"
          />
        ) : (
          <div
            className="text-sm font-semibold text-slate-200 cursor-pointer hover:text-blue-400 transition truncate"
            onClick={() => { setNameValue(sessionName); setEditingName(true) }}
            title="Click to rename"
          >
            {sessionName}
          </div>
        )}
        {seedTopic && (
          <div className="text-xs text-slate-500 mt-1 truncate">{seedTopic}</div>
        )}
      </div>

      {/* Layer toggles */}
      <div className="p-3 border-b border-slate-700/60">
        <button
          className="w-full flex items-center justify-between text-xs font-medium text-slate-400 hover:text-slate-200 transition mb-2"
          onClick={() => setLayersOpen((v) => !v)}
        >
          <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Layers</span>
          {layersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {layersOpen && (
          <div className="space-y-1.5">
            {LAYER_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                <button
                  role="switch"
                  aria-checked={layerToggles[key]}
                  onClick={() => toggleLayer(key)}
                  className={`relative w-8 h-4 rounded-full transition ${layerToggles[key] ? 'bg-blue-600' : 'bg-slate-700'}`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${layerToggles[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-xs text-slate-400 group-hover:text-slate-200 transition">{label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Depth slider */}
      <div className="p-3 border-b border-slate-700/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Exploration depth</span>
          <span className="text-xs text-blue-400 font-mono">{depth}</span>
        </div>
        <input
          type="range" min={1} max={4} value={depth}
          onChange={(e) => setDepth(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-slate-600 mt-0.5">
          <span>1</span><span>4</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="p-3 flex flex-col gap-2">
        <button
          onClick={onGoDeeper}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition"
        >
          <GitBranch className="w-3.5 h-3.5" /> Go Deeper
        </button>
        <button
          onClick={onGenerateDirections}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-medium transition"
        >
          <Zap className="w-3.5 h-3.5" /> Generate Directions
        </button>
        <button
          onClick={onExport}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition"
        >
          <Download className="w-3.5 h-3.5" /> Export JSON
        </button>
      </div>
    </aside>
  )
}
