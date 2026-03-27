import s from './styles'

export default function SuccessScreen({ onOrders, onCatalog }) {
  return (
    <div style={s.successPage}>
      <div style={s.successIcon}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h2 style={s.successTitle}>Заказ принят!</h2>
      <p style={s.successDesc}>Ожидайте подтверждения от менеджера</p>
      <button style={s.primaryBtn} onClick={onOrders}>Мои заказы</button>
      <button style={s.linkBtn} onClick={onCatalog}>Продолжить покупки</button>
    </div>
  )
}
