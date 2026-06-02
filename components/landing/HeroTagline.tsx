'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Rotating hero tagline. Each variant pairs a leading phrase with an accent phrase.
 * The accent crossfades + slides between options; the lead morphs in lockstep so the
 * sentence always reads cleanly.
 *
 * Pauses on hover so users can read whatever caught their eye.
 */

interface Variant {
  lead: string
  accent: string
}

const VARIANTS: Variant[] = [
  { lead: 'The Google Maps', accent: 'of research' },
  { lead: 'The atlas', accent: 'of literature' },
  { lead: 'Mission control', accent: 'for your reading' },
  { lead: 'The bird’s-eye view', accent: 'of any field' },
  { lead: 'The shortest path', accent: 'through the literature' },
]

const ROTATION_MS = 3600
const TRANSITION_MS = 600

export default function HeroTagline() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [animating, setAnimating] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (paused) return
    function tick() {
      setAnimating(true)
      setTimeout(() => {
        setIndex((i) => (i + 1) % VARIANTS.length)
        setAnimating(false)
      }, TRANSITION_MS)
      timeoutRef.current = setTimeout(tick, ROTATION_MS)
    }
    timeoutRef.current = setTimeout(tick, ROTATION_MS)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [paused])

  const current = VARIANTS[index]

  return (
    <h1
      className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-tight cursor-default select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-live="polite"
    >
      <span
        className="block transition-all duration-500"
        style={{
          opacity: animating ? 0 : 1,
          transform: animating ? 'translateY(-8px)' : 'translateY(0)',
        }}
      >
        {current.lead}
      </span>
      <span
        className="block bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500 bg-clip-text text-transparent animate-gradient transition-all duration-500"
        style={{
          opacity: animating ? 0 : 1,
          transform: animating ? 'translateY(8px)' : 'translateY(0)',
        }}
      >
        {current.accent}
      </span>
      <span className="sr-only">{`${current.lead} ${current.accent}`}</span>
    </h1>
  )
}
