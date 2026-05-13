import { useEffect, useState } from 'react'
import { getSettings } from '../api'

// In-flight promise cache so multiple components share one network request.
let _cache = null
let _ts = 0
const TTL = 30_000 // 30s — settings rarely change

function fetchEnabled() {
  const now = Date.now()
  if (_cache && now - _ts < TTL) return _cache
  _ts = now
  _cache = getSettings()
    .then(s => s?.subscriptions_enabled !== false)
    .catch(() => true) // fail-open: backend down → assume enabled
  return _cache
}

export function invalidateSubscriptionsEnabled() {
  _cache = null
  _ts = 0
}

/**
 * Master switch for the subscriptions module.
 * Returns `null` while loading, `true`/`false` once known.
 */
export function useSubscriptionsEnabled() {
  const [enabled, setEnabled] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetchEnabled().then(v => { if (!cancelled) setEnabled(v) })
    return () => { cancelled = true }
  }, [])
  return enabled
}
