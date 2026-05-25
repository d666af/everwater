import { useEffect, useRef } from 'react'

const INTERVAL_MS = 60_000

export function useVersionCheck() {
  const knownVersion = useRef(null)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/version.json?_=' + Date.now(), { cache: 'no-store' })
        if (!res.ok) return
        const { v } = await res.json()
        if (knownVersion.current === null) {
          knownVersion.current = v
        } else if (v !== knownVersion.current) {
          window.location.reload()
        }
      } catch {
        // network error — skip silently
      }
    }

    check()
    const id = setInterval(check, INTERVAL_MS)
    return () => clearInterval(id)
  }, [])
}
