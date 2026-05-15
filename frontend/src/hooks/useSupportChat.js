import { useEffect, useState } from 'react'
import { getSettings } from '../api'

// Shared in-flight promise cache: settings rarely change so 30s TTL is fine
// and multiple subscribers across the tree only spawn one network request.
let _cache = null
let _ts = 0
const TTL = 30_000

function fetchSupport() {
  const now = Date.now()
  if (_cache && now - _ts < TTL) return _cache
  _ts = now
  _cache = getSettings()
    .then(s => ({
      enabled: s?.support_chat_enabled !== false,
      contacts: s?.support_contacts_text || '',
    }))
    .catch(() => ({ enabled: true, contacts: '' })) // fail-open
  return _cache
}

export function invalidateSupportChat() {
  _cache = null
  _ts = 0
}

/**
 * Returns the current support module state.
 * `null` while loading, then `{ enabled: bool, contacts: string }`.
 */
export function useSupportChat() {
  const [state, setState] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetchSupport().then(v => { if (!cancelled) setState(v) })
    return () => { cancelled = true }
  }, [])
  return state
}
