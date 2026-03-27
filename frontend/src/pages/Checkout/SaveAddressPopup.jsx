import s, { C } from './styles'

export default function SaveAddressPopup({ address, onSave, onSkip }) {
  return (
    <div style={s.popupOverlay}>
      <div style={s.popupCard}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${C}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" fill={C}/>
          </svg>
        </div>
        <h3 style={s.popupTitle}>Сохранить адрес?</h3>
        <p style={s.popupDesc}>
          Сохраните «{address}» для быстрого оформления следующих заказов
        </p>
        <div style={s.popupBtnRow}>
          <button style={s.popupBtnGhost} onClick={onSkip}>Нет</button>
          <button style={s.popupBtnPrimary} onClick={onSave}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}
