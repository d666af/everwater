import { useEffect, useState } from 'react'
import WarehouseLayout from '../../components/warehouse/WarehouseLayout'
import { getWarehouseStock, addProduction } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

export default function WarehouseStock() {
  const [stock, setStock] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = () => {
    setLoading(true)
    getWarehouseStock()
      .then(data => {
        setStock(data.stock || [])
        setHistory((data.history || []).slice(0, 20))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const totalItems = stock.reduce((s, p) => s + (p.quantity || 0), 0)

  return (
    <WarehouseLayout title="Склад">
      {showAdd && <AddProductionModal onClose={() => setShowAdd(false)} onSave={async (name, qty, note) => { await addProduction(name, qty, note); load() }} />}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {[[stock.length, 'Позиций'], [totalItems, 'Единиц'], [history.length, 'Записей']].map(([v, l]) => (
          <div key={l} style={{ flex: 1, background: '#fff', borderRadius: 18, padding: '14px 10px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: TEXT }}>{v}</div>
            <div style={{ fontSize: 10, color: TEXT2, marginTop: 3, fontWeight: 500 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Add production button */}
      <button style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: '100%', padding: '12px 14px', borderRadius: 14, border: 'none',
        background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 15, fontWeight: 700,
        cursor: 'pointer', boxShadow: '0 4px 14px rgba(141,198,63,0.3)', WebkitTapHighlightColor: 'transparent',
        marginBottom: 20,
      }} onClick={() => setShowAdd(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
        Записать производство
      </button>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* Current stock */}
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 8px' }}>Текущий остаток</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {stock.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: TEXT2, fontSize: 14 }}>Нет товаров на складе</div>
            ) : stock.map(p => (
              <div key={p.product_name} style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${C}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z" fill={C} opacity="0.4"/><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z" stroke={C} strokeWidth="1.5"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: TEXT }}>{p.product_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: p.quantity <= 5 ? '#E03131' : C }}>{p.quantity}</div>
                  <div style={{ fontSize: 10, color: TEXT2 }}>шт.</div>
                </div>
              </div>
            ))}
          </div>

          {/* History */}
          {history.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 8px' }}>Последние операции</div>
              <div style={{ background: '#fff', borderRadius: 18, padding: '10px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                {history.map((h, i) => {
                  const isAdd = h.type === 'production'
                  const isIssue = h.type === 'issue'
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < history.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: isAdd ? '#EBFBEE' : isIssue ? '#FFF8E6' : '#E8F4FD', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isAdd && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#2B8A3E" strokeWidth="2.2" strokeLinecap="round"/></svg>}
                        {isIssue && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M14 5l7 7-7 7" stroke="#E67700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        {!isAdd && !isIssue && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M10 19l-7-7 7-7" stroke="#1971C2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{h.product_name} × {h.quantity}</div>
                        <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>
                          {isAdd ? 'Производство' : isIssue ? `Выдано: ${h.courier_name}` : `Возврат: ${h.courier_name}`}
                          {h.note && ` · ${h.note}`}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: TEXT2, flexShrink: 0 }}>{new Date(h.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </WarehouseLayout>
  )
}

function AddProductionModal({ onClose, onSave }) {
  const [name, setName] = useState('Вода 20л')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const PRODUCTS = ['Вода 20л', 'Вода 10л', 'Вода 5л', 'Вода 1.5л', 'Вода 1л', 'Вода 0.5л', 'Газ. вода 1.5л', 'Газ. вода 1л', 'Газ. вода 0.5л']

  const handle = async () => {
    if (!qty || Number(qty) <= 0) return
    setLoading(true)
    try { await onSave(name, Number(qty), note.trim()); onClose() }
    catch { alert('Ошибка') }
    finally { setLoading(false) }
  }

  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={st.sheet}>
        <div style={st.handle} />
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, textAlign: 'center' }}>Записать производство</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Продукт</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRODUCTS.map(p => (
              <button key={p} onClick={() => setName(p)} style={{
                padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: name === p ? `linear-gradient(135deg, ${C}, ${CD})` : '#F8F9FA',
                color: name === p ? '#fff' : TEXT,
                border: name === p ? 'none' : `1px solid ${BORDER}`,
              }}>{p}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Количество</div>
          <input style={st.input} type="number" inputMode="numeric" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} />
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Заметка</div>
          <input style={st.input} placeholder="Необязательно" value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <button style={{ ...st.primaryBtn, ...(!qty || Number(qty) <= 0 ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }} disabled={!qty || Number(qty) <= 0 || loading} onClick={handle}>
          {loading ? 'Записываю...' : `Добавить ${qty || 0} шт.`}
        </button>
        <button style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

const st = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' },
  sheet: { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', padding: '12px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)' },
  handle: { width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px', display: 'block' },
  input: { border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: '13px 15px', fontSize: 16, outline: 'none', background: '#FAFAFA', color: TEXT, width: '100%', boxSizing: 'border-box' },
  primaryBtn: { padding: 16, borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(141,198,63,0.35)' },
}
