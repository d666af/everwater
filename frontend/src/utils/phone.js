/**
 * Formats any phone to +998 XX XXX XX XX for display.
 * Works with any of: 998931005870 / +998 90 102 09 00 / 901020900
 */
export function formatPhone(raw) {
  if (!raw) return ''
  const digits = String(raw).replace(/\D/g, '')
  const n = digits.length >= 9 ? digits.slice(-9) : digits
  if (n.length === 9) return `+998 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`
  return String(raw)
}
