'use client'
import { useEffect } from 'react'

export function useSessionHeartbeat(sessionId: string | null) {
  useEffect(() => {
    if (!sessionId) return

    const ping = () => {
      fetch('/api/session/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        keepalive: true,
      }).catch(() => {})
    }

    ping()
    const interval = setInterval(ping, 60_000)

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        navigator.sendBeacon(
          '/api/session/heartbeat',
          new Blob([JSON.stringify({ sessionId })], { type: 'application/json' })
        )
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [sessionId])
}
