'use client'

import { useEffect, useState } from 'react'

/**
 * Returns true when the viewport is phone-sized (or a coarse/touch pointer on a
 * narrow screen). SSR-safe: starts false on the server and first client paint,
 * then corrects after mount, so it never causes a hydration mismatch.
 *
 * `breakpoint` is the max width (px) considered "phone". 768 = Tailwind `md`.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [breakpoint])

  return isMobile
}
