import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getProducts, createProduct, updateProduct, deleteProduct } from '../../api'

const EMPTY = { name: '', description: '', volume: '', price: '', photo_url: '', is_active: true, sort_order: 0 }

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null | 'new' | product object
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    getProducts(true)
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openNew = () => { setForm(EMPTY); setEditing('new'); setError('') }
  const openEdit = (p) => {
    setForm({ name: p.name, description: p.description || '', volume: p.volume, price: p.price, photo_url: p.photo_url || '', is_active: p.is_active, sort_order: p.sort_order })
    setEditing(p)
    setError('')
  }

  const save = async () => {
    if (!form.name.trim() || !form.price || !form.volume) { setError('Заполните обязательные поля (название, объём, цена)'); return }
    setSaving(true); setError('')
    try {
      const data = { ...form, volume: Number(form.volume), price: Number(form.price), sort_order: Number(form.sort_order) }
      if (editing === 'new') await createProduct(data)
      else await updateProduct(editing.id, data)
      setEditing(null)
      load()
    } catch { setError('Ошибка при сохранении') } finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!window.confirm('Удалить товар?')) return
    try { await deleteProduct(id); load() }
    catch { alert('Ошибка') }
  }

  const f = (name) => ({ value: form[name], onChange: e => setForm(p => ({ ...p, [name]: e.target.value })) })

  return (
    <AdminLayout title="Товары">
      <div style={styles.topBar}>
        <div style={styles.count}>{products.length} товаров</div>
        <button style={styles.addBtn} onClick={openNew}>+ Добавить товар</button>
      </div>

      {/* Form */}
      {editing && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>{editing === 'new' ? 'Новый товар' : 'Редактировать товар'}</h3>
          <div style={styles.formGrid}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Название *</label>
              <input style={styles.input} placeholder="Вода питьевая 18.9л" {...f('name')} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Объём (л) *</label>
              <input style={styles.input} type="number" placeholder="18.9" step="0.1" {...f('volume')} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Цена (сум) *</label>
              <input style={styles.input} type="number" placeholder="350" {...f('price')} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Порядок</label>
              <input style={styles.input} type="number" placeholder="0" {...f('sort_order')} />
            </div>
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Описание</label>
            <textarea style={styles.textarea} placeholder="Природная горная вода..." rows={3} {...f('description')} />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>URL фото</label>
            <input style={styles.input} placeholder="https://example.com/photo.jpg" {...f('photo_url')} />
          </div>
          {form.photo_url && (
            <img src={form.photo_url} alt="" style={styles.preview} onError={e => e.target.style.display = 'none'} />
          )}
          <label style={styles.checkbox}>
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
            <span>Активен (отображается в каталоге)</span>
          </label>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formActions}>
            <button style={styles.cancelBtn} onClick={() => setEditing(null)}>Отмена</button>
            <button style={styles.saveBtn} onClick={save} disabled={saving}>
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.center}>Загрузка...</div>
      ) : (
        <div style={styles.grid}>
          {products.map(p => (
            <div key={p.id} style={{ ...styles.card, opacity: p.is_active ? 1 : 0.55 }}>
              {p.photo_url ? (
                <img src={p.photo_url} alt={p.name} style={styles.img} />
              ) : (
                <div style={styles.imgPlaceholder}>💧</div>
              )}
              <div style={styles.cardBody}>
                <div style={styles.productName}>{p.name}</div>
                <div style={styles.productVol}>{p.volume} л</div>
                {p.description && <div style={styles.productDesc}>{p.description}</div>}
                <div style={styles.cardFooter}>
                  <span style={styles.price}>{p.price} сум</span>
                  {!p.is_active && <span style={styles.inactiveBadge}>Скрыт</span>}
                </div>
                <div style={styles.cardActions}>
                  <button style={styles.editBtn} onClick={() => openEdit(p)}>✏️ Изменить</button>
                  <button style={styles.deleteBtn} onClick={() => remove(p.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}

const styles = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  count: { fontSize: 14, color: '#888' },
  addBtn: {
    padding: '10px 20px', background: '#1a237e', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  formCard: {
    background: '#fff', borderRadius: 14, padding: 24, marginBottom: 24,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: 14,
  },
  formTitle: { margin: 0, fontSize: 18, fontWeight: 700, color: '#1a237e' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#555' },
  input: {
    border: '1px solid #ddd', borderRadius: 8, padding: '9px 12px',
    fontSize: 14, outline: 'none', background: '#fafafa',
  },
  textarea: {
    border: '1px solid #ddd', borderRadius: 8, padding: '9px 12px',
    fontSize: 14, outline: 'none', resize: 'vertical', background: '#fafafa',
  },
  preview: { width: 100, height: 100, objectFit: 'cover', borderRadius: 8 },
  checkbox: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' },
  error: { color: '#c62828', fontSize: 13 },
  formActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: {
    padding: '9px 20px', border: '1px solid #ddd', borderRadius: 8,
    background: '#fff', color: '#333', fontSize: 14, cursor: 'pointer',
  },
  saveBtn: {
    padding: '9px 24px', background: '#1a237e', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  center: { textAlign: 'center', padding: 60, color: '#888' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  card: {
    background: '#fff', borderRadius: 14, overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    display: 'flex', flexDirection: 'column',
  },
  img: { width: '100%', height: 140, objectFit: 'cover' },
  imgPlaceholder: {
    width: '100%', height: 140, background: '#e8eaf6',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48,
  },
  cardBody: { padding: 14, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  productName: { fontWeight: 700, fontSize: 15 },
  productVol: { color: '#888', fontSize: 13 },
  productDesc: { fontSize: 12, color: '#666', flex: 1 },
  cardFooter: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 },
  price: { fontWeight: 800, fontSize: 18, color: '#1565c0' },
  inactiveBadge: { fontSize: 11, background: '#fbe9e7', color: '#c62828', padding: '2px 8px', borderRadius: 10, fontWeight: 600 },
  cardActions: { display: 'flex', gap: 6, marginTop: 8 },
  editBtn: {
    flex: 1, padding: '7px 0', border: '1px solid #1a237e', borderRadius: 7,
    background: '#fff', color: '#1a237e', fontSize: 12, cursor: 'pointer', fontWeight: 600,
  },
  deleteBtn: {
    padding: '7px 12px', border: '1px solid #e57373', borderRadius: 7,
    background: '#fff', color: '#e53935', fontSize: 14, cursor: 'pointer',
  },
}
