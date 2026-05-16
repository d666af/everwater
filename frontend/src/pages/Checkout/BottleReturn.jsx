import s, { C, GRAD } from './styles'

function plural(n, one, few, many) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export default function BottleReturn({ returnCount, onCountChange, bottleDiscount, bottlesOwed, settings,
                                       fullBottlePrice, priceWithReturn, discountPerBottle,
                                       qty20L = 0 }) {
  const showButtons = settings.bottle_return_buttons_visible !== false
  const maxReturn = bottlesOwed
  const displayCount = showButtons ? returnCount : maxReturn

  // How many ordered bottles will NOT be returned (charged at full price)
  const missing = Math.max(0, qty20L - displayCount)
  const surcharge = discountPerBottle || 0
  const extraTotal = missing * surcharge

  let message
  if (qty20L > 0 && displayCount >= qty20L) {
    message = (
      <span>
        Вы возвращаете <b>{qty20L}</b> {plural(qty20L, 'бутылку', 'бутылки', 'бутылок')} 19л.
      </span>
    )
  } else if (qty20L > 0) {
    message = (
      <span>
        Вы возвращаете <b>{displayCount} из {qty20L}</b>. За каждую невозвращённую
        (всего <b>{missing}</b> {plural(missing, 'бутылку', 'бутылки', 'бутылок')}) к заказу
        будет добавлено <b>{surcharge.toLocaleString()} сум</b> за бутылку
        {extraTotal > 0 && missing > 1 && <> · итого <b>{extraTotal.toLocaleString()} сум</b></>}.
      </span>
    )
  } else {
    message = null
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

        {message && (
          <div style={{
            background: missing > 0 ? '#FFF7E6' : '#F0FFF0',
            borderRadius: 10, padding: '10px 12px', marginTop: 10,
            fontSize: 13, color: '#3c3c43', lineHeight: 1.5,
          }}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}
