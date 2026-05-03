import s, { C, GRAD } from './styles'

export default function BottleReturn({ returnCount, onCountChange, bottleDiscount, bottlesOwed, settings }) {
  const showButtons = settings.bottle_return_buttons_visible !== false
  // bottlesOwed prop is already the capped max (computed in parent)
  const maxReturn = bottlesOwed
  const displayCount = showButtons ? returnCount : maxReturn

  return (
    <div style={s.section}>
      <div style={s.sLabel}>Возврат бутылок (19 л)</div>
      <div style={s.card}>
        <div style={s.bottleRow}>
          <div>
            <span style={s.bottleText}>Количество бутылок</span>
            <div style={s.bottleInfo}>
              {bottlesOwed > 0
                ? `У вас ${bottlesOwed} бут. к возврату`
                : 'Нет бутылок к возврату'}
            </div>
          </div>
          {showButtons && (
            <div style={s.stepper}>
              <button
                style={returnCount <= 0 ? { ...s.stepperBtn, ...s.stepperBtnDisabled } : s.stepperBtn}
                onClick={() => onCountChange(Math.max(0, returnCount - 1))}
                disabled={returnCount <= 0}
              >−</button>
              <span style={s.stepperVal}>{returnCount}</span>
              <button
                style={returnCount >= maxReturn ? { ...s.stepperBtn, ...s.stepperBtnDisabled } : s.stepperBtn}
                onClick={() => onCountChange(Math.min(maxReturn, returnCount + 1))}
                disabled={returnCount >= maxReturn}
              >+</button>
            </div>
          )}
          {!showButtons && (
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>{displayCount}</span>
          )}
        </div>
        {bottleDiscount > 0 && (
          <div style={s.discountLine}>Скидка за возврат: −{bottleDiscount.toLocaleString()} сум</div>
        )}
      </div>
    </div>
  )
}
