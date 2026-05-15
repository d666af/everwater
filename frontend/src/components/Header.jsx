import { useLocation } from 'react-router-dom'

export default function Header() {
  const { pathname } = useLocation()
  const isStaffOrAuth = pathname === '/login'
    || pathname.startsWith('/admin')
    || pathname.startsWith('/courier')
    || pathname.startsWith('/manager')
    || pathname.startsWith('/warehouse')
    || pathname.startsWith('/checkout')
    || pathname === '/profile' // profileHeader already adds enough top room for the FABs
  if (isStaffOrAuth) return null
  // Client pages: reserve room for the top-floating logout/role FABs
  // (they live in BottomNav.jsx with position: fixed; top: 16).
  return <div style={{ height: 56 }} />
}
