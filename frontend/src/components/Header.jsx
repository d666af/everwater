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
  return null
}
