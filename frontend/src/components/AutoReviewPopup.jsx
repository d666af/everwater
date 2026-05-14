import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useOrdersStore } from '../store/orders'
import { useAuthStore } from '../store/auth'
import { getUserByTelegram, getUserOrders } from '../api'
import ReviewModal from './ReviewModal'

const LS_KEY = 'everwater_review_dismissed_ids'

function loadDismissed() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw))
  } catch {
    return new Set()
  }
}

function saveDismissed(set) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...set]))
  } catch {
    /* localStorage might be unavailable */
  }
}

/**
 * Global popup that asks for a review on the first unrated delivered order.
 * - Persists dismissed IDs in localStorage — once user closes for an order,
 *   the popup never re-appears for that order on this device.
 * - Hidden on /login, /checkout (don't interrupt mid-flow).
 * - Hidden on staff routes (/admin, /courier, /manager, /warehouse).
 */
export default function AutoReviewPopup() {
  const location = useLocation()
  const { orders, setOrders, loaded } = useOrdersStore()
  const authUser = useAuthStore(s => s.user)

  const [dismissed, setDismissed] = useState(loadDismissed)
  const [reviewed, setReviewed] = useState(new Set())
  const [shown, setShown] = useState(false)
  const [active, setActive] = useState(null) // order being reviewed right now

  // Routes where the popup must NOT appear
  const blocked = useMemo(() => {
    const p = location.pathname
    return p === '/login'
      || p.startsWith('/checkout')
      || p.startsWith('/admin')
      || p.startsWith('/courier')
      || p.startsWith('/manager')
      || p.startsWith('/warehouse')
  }, [location.pathname])

  // Make sure orders are fetched at least once when the client app boots
  useEffect(() => {
    if (loaded || blocked) return
    let cancelled = false
    const load = async () => {
      try {
        let userId = null
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user
        if (tgUser?.id) {
          const u = await getUserByTelegram(tgUser.id)
          userId = u?.id
        } else if (authUser?.id) {
          userId = authUser.id
        }
        if (userId && !cancelled) {
          const data = await getUserOrders(userId)
          if (Array.isArray(data)) setOrders(data)
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [loaded, blocked, authUser?.id]) // eslint-disable-line

  // Pick the first eligible delivered order
  const candidate = useMemo(() => {
    if (blocked || active || shown) return null
    return orders.find(o =>
      o.status === 'delivered'
      && !o.review_id
      && !reviewed.has(o.id)
      && !dismissed.has(o.id)
    )
  }, [orders, blocked, active, shown, reviewed, dismissed])

  // Show automatically once a candidate becomes available
  useEffect(() => {
    if (candidate && !active && !shown) {
      setActive(candidate)
      setShown(true)
    }
  }, [candidate, active, shown])

  const dismiss = (id) => {
    if (id) {
      const next = new Set([...dismissed, id])
      setDismissed(next)
      saveDismissed(next)
    }
    setActive(null)
  }

  const done = (id) => {
    if (id) {
      setReviewed(prev => new Set([...prev, id]))
      const next = new Set([...dismissed, id])
      setDismissed(next)
      saveDismissed(next)
    }
    setActive(null)
  }

  if (!active) return null
  return (
    <ReviewModal
      order={active}
      autoPopup
      onClose={() => dismiss(active.id)}
      onDone={() => done(active.id)}
    />
  )
}
