import { useEffect, useRef, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getProducts, createProduct, updateProduct, deleteProduct, uploadProductPhoto } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.12)'

const EMPTY = { name: '', description: '', volume: '', price: '', photo_url: '', is_active: true, sort_order: 0, has_bottle_deposit: false }

function ProductForm({ title, form, setForm, onSave, onCancel, saving, error }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')

  const f = (name) => ({ value: form[name], onChange: e => setForm(p => ({ ...p, [name]: e.target.value })) })

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true); setUploadErr('')
    try {
      const url = await uploadProductPhoto(file)
      setForm(p => ({ ...p, photo_url: url }))
    } catch {
      setUploadErr('Не удалось загрузить фото')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div style={s.formCard}>
      <div style={s.formTitle}>{title}</div>
      <div style={s.formGrid}>
        <div style={s.field}>
          <div style={s.label}>Название *</div>
          <input style={s.input} placeholder="Вода питьевая 20л" {...f('name')} />
        </div>
        <div style={s.field}>
          <div style={s.label}>Объём (л) *</div>
          <input style={s.input} type="number" placeholder="20" step="0.1" {...f('volume')} />
        </div>
        <div style={s.field}>
          <div style={s.label}>Цена (сум) *</div>
          <input style={s.input} type="number" placeholder="35000" {...f('price')} />
        </div>
        <div style={s.field}>
          <div style={s.label}>Порядок</div>
          <input style={s.input} type="number" placeholder="0" {...f('sort_order')} />
        </div>
      </div>
      <div style={s.field}>
        <div style={s.label}>Описание</div>
        <textarea style={s.textarea} placeholder="Природная горная вода..." rows={2} {...f('description')} />
      </div>

      <div style={s.field}>
        <div style={s.label}>Фото товара</div>
        <div style={s.photoRow}>
          {form.photo_url ? (
            <div style={s.photoPreviewWrap}>
              <img src={form.photo_url} alt="" style={s.imgPreview}
                onError={e => e.target.style.display = 'none'} />
              <button style={s.removePhotoBtn}
                onClick={() => setForm(p => ({ ...p, photo_url: '' }))}>✕</button>
            </div>
          ) : (
            <div style={s.photoPlaceholder}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                  stroke={C} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button style={{ ...s.uploadBtn, opacity: uploading ? 0.6 : 1 }}
              onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Загрузка...' : form.photo_url ? '🔄 Заменить фото' : '📷 Загрузить фото'}
            </button>
            {uploadErr && <div style={s.uploadErr}>{uploadErr}</div>}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={handleFileChange} />
      </div>

      <label style={s.checkRow}>
        <input type="checkbox" checked={form.is_active}
          onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
        <span style={{ fontSize: 14, color: TEXT }}>Активен (отображается в каталоге)</span>
      </label>
      <label style={s.checkRow}>
        <input type="checkbox" checked={form.has_bottle_deposit || false}
          onChange={e => setForm(p => ({ ...p, has_bottle_deposit: e.target.checked }))} />
        <span style={{ fontSize: 14, color: TEXT }}>Залоговая цена (показывать цену со сдачей бутылки как основную)</span>
      </label>
      {error && <div style={s.error}>{error}</div>}
      <div style={s.formActions}>
        <button style={s.cancelBtn} onClick={onCancel}>Отмена</button>
        <button style={{ ...s.saveBtn, ...(saving ? { opacity: 0.6 } : {}) }}
          onClick={onSave} disabled={saving}>
          {saving ? 'Сохраняю...' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    getProducts(true).then(setProducts).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openNew = () => { setForm(EMPTY); setEditing('new'); setError('') }
  const openEdit = (p) => {
    setForm({ name: p.name, description: p.description || '', volume: p.volume, price: p.price, photo_url: p.photo_url || '', is_active: p.is_active, sort_order: p.sort_order, has_bottle_deposit: p.has_bottle_deposit || false })
    setEditing(p); setError('')
  }

  const save = async () => {
    if (!form.name.trim() || !form.price || !form.volume) {
      setError('Заполните обязательные поля'); return
    }
    setSaving(true); setError('')
    try {
      const data = { ...form, volume: Number(form.volume), price: Number(form.price), sort_order: Number(form.sort_order) }
      if (editing === 'new') await createProduct(data)
      else await updateProduct(editing.id, data)
      setEditing(null); load()
    } catch { setError('Ошибка при сохранении') } finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!window.confirm('Удалить товар?')) return
    try { await deleteProduct(id); load() } catch { alert('Ошибка') }
  }

  const active = products.filter(p => p.is_active).length

  return (
    <AdminLayout title="Товары">
      {/* Top bar */}
      <div style={s.topBar}>
        <div style={s.counts}>
          <span style={s.countChip}>{products.length} всего</span>
          <span style={{ ...s.countChip, background: '#EBFBEE', color: '#2B8A3E' }}>{active} активных</span>
        </div>
        <button style={s.addBtn} onClick={openNew}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          Добавить товар
        </button>
      </div>

      {editing && (
        <ProductForm
          title={editing === 'new' ? 'Новый товар' : 'Редактировать товар'}
          form={form} setForm={setForm}
          onSave={save} onCancel={() => setEditing(null)}
          saving={saving} error={error}
        />
      )}

      {loading ? (
        <div style={s.center}><div style={s.spinner} /></div>
      ) : products.length === 0 ? (
        <div style={s.empty}>
          <svg width="48" height="58" viewBox="0 0 40 48" fill="none">
            <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
              fill="#E8F7D0" stroke={C} strokeWidth="1.5"/>
          </svg>
          <div style={s.emptyText}>Товаров нет</div>
          <button style={s.addBtn} onClick={openNew}>Добавить первый товар</button>
        </div>
      ) : (
        <div style={s.grid}>
          {products.map(p => (
            <div key={p.id} style={{ ...s.card, opacity: p.is_active ? 1 : 0.55 }}>
              {p.photo_url ? (
                <img src={p.photo_url} alt={p.name} style={s.img}
                  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
              ) : null}
              <div style={{ ...s.imgPlaceholder, display: p.photo_url ? 'none' : 'flex' }}>
                <svg width="32" height="40" viewBox="0 0 40 48" fill="none">
                  <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
                    fill="#E8F7D0" stroke={C} strokeWidth="1.5"/>
                </svg>
              </div>
              <div style={s.cardBody}>
                <div style={s.productName}>{p.name}</div>
                <div style={s.productVol}>{p.volume} л</div>
                {p.description && <div style={s.productDesc}>{p.description}</div>}
                <div style={s.cardFooter}>
                  <span style={s.price}>{Number(p.price).toLocaleString()} сум</span>
                  {!p.is_active && <span style={s.hiddenBadge}>Скрыт</span>}
                </div>
                <div style={s.cardActions}>
                  <button style={s.editBtn} onClick={() => openEdit(p)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                    Изменить
                  </button>
                  <button style={s.deleteBtn} onClick={() => remove(p.id)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}

const s = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  counts: { display: 'flex', gap: 8 },
  countChip: { fontSize: 13, background: '#F2F2F7', color: TEXT2, padding: '5px 12px', borderRadius: 999, fontWeight: 600 },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px',
    background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff',
    border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(141,198,63,0.35)', WebkitTapHighlightColor: 'transparent',
  },

  formCard: {
    background: '#fff', borderRadius: 16, padding: 20, marginBottom: 20,
    border: `1px solid ${BORDER}`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  formTitle: { fontWeight: 800, fontSize: 18, color: TEXT },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px',
    fontSize: 15, outline: 'none', background: '#FAFAFA', color: TEXT,
  },
  textarea: {
    border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px',
    fontSize: 15, outline: 'none', resize: 'vertical', background: '#FAFAFA',
    color: TEXT, fontFamily: 'inherit',
  },
  photoRow: { display: 'flex', alignItems: 'center', gap: 14 },
  photoPreviewWrap: { position: 'relative', width: 90, height: 90, flexShrink: 0 },
  imgPreview: { width: 90, height: 90, objectFit: 'cover', borderRadius: 12 },
  removePhotoBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: '50%',
    background: '#E03131', color: '#fff', border: 'none',
    fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, lineHeight: 1,
  },
  photoPlaceholder: {
    width: 90, height: 90, flexShrink: 0,
    background: '#F0FFF4', borderRadius: 12, border: `1.5px dashed ${C}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  uploadBtn: {
    padding: '10px 16px', background: '#F0FFF4', border: `1.5px solid ${C}`,
    borderRadius: 10, fontSize: 13, fontWeight: 700, color: C, cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  uploadErr: { fontSize: 12, color: '#E03131' },
  checkRow: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  error: { color: '#E03131', fontSize: 13, fontWeight: 500 },
  formActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: {
    padding: '12px 20px', border: `1.5px solid ${BORDER}`, borderRadius: 12,
    background: '#fff', color: TEXT2, fontSize: 14, cursor: 'pointer', fontWeight: 600,
  },
  saveBtn: {
    padding: '12px 24px', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff',
    border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(141,198,63,0.35)',
  },

  center: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`,
    animation: 'spin 0.8s linear infinite',
  },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 20px' },
  emptyText: { fontSize: 16, fontWeight: 700, color: TEXT2 },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14 },
  card: {
    background: '#fff', borderRadius: 16, overflow: 'hidden',
    border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    display: 'flex', flexDirection: 'column',
  },
  img: { width: '100%', height: 130, objectFit: 'cover' },
  imgPlaceholder: {
    width: '100%', height: 130, background: '#F0FFF4',
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { padding: 14, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  productName: { fontWeight: 700, fontSize: 14, color: TEXT, lineHeight: 1.3 },
  productVol: { color: TEXT2, fontSize: 13 },
  productDesc: { fontSize: 12, color: TEXT2, flex: 1, lineHeight: 1.4 },
  cardFooter: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 },
  price: { fontWeight: 800, fontSize: 17, color: TEXT },
  hiddenBadge: { fontSize: 11, background: '#FFF5F5', color: '#E03131', padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
  cardActions: { display: 'flex', gap: 6, marginTop: 8 },
  editBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '8px 0', border: `1.5px solid ${BORDER}`, borderRadius: 10,
    background: '#fff', color: TEXT, fontSize: 12, cursor: 'pointer', fontWeight: 600,
    WebkitTapHighlightColor: 'transparent',
  },
  deleteBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '8px 12px', border: '1.5px solid rgba(224,49,49,0.3)', borderRadius: 10,
    background: '#FFF5F5', color: '#E03131', cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
}
