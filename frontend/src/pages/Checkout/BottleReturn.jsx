import s, { C, GRAD } from './styles'

export default function BottleReturn({ returnCount, onCountChange, bottleDiscount, bottlesOwed, settings,
                                       fullBottlePrice, priceWithReturn, discountPerBottle }) {
  const showButtons = settings.bottle_return_buttons_visible !== false
  const maxReturn = bottlesOwed
  const displayCount = showButtons ? returnCount : maxReturn

  const depositInfoBox = {
    background: '#F0FFF0', borderRadius: 10, padding: '10px 12px',
    marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4,
  }
  const depositRow = {
    display: 'flex', justifyContent: 'space-between',
    fontSize: 13, color: '#3c3c43',
  }

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

        {fullBottlePrice != null && priceWithReturn != null && (
          <div style={depositInfoBox}>
            <div style={depositRow}>
              <span>♻ Со сдачей бутылки</span>
              <b style={{ color: '#2B8A3E' }}>{priceWithReturn.toLocaleString()} сум</b>
            </div>
            <div style={depositRow}>
              <span>Без возврата</span>
              <span>{fullBottlePrice.toLocaleString()} сум</span>
            </div>
            {discountPerBottle > 0 && (
              <div style={{ fontSize: 11, color: '#8e8e93', marginTop: 2 }}>
                Скидка за каждую сданную бутылку: {discountPerBottle.toLocaleString()} сум
              </div>
            )}
          </div>
        )}

        {bottleDiscount > 0 && (
          <div style={s.discountLine}>Скидка за возврат: −{bottleDiscount.toLocaleString()} сум</div>
        )}
      </div>
    </div>
  )
}
