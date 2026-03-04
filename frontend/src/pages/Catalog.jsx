import { useEffect, useState } from 'react'
import { getProducts } from '../api'
import ProductCard from '../components/ProductCard'

export default function Catalog() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={styles.center}>Загрузка...</div>
  if (!products.length) return <div style={styles.center}>Товары не найдены</div>

  return (
    <div style={styles.grid}>
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  )
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
    padding: 16,
  },
  center: { textAlign: 'center', padding: 40, color: '#888' },
}
