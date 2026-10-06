import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import API from './Auth/config/API'

const Category = () => {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    API.get('/api/v1/categories')
      .then((r) => setCategories(r.data.categories || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <Layout title="Categories - Ecommerce App">
      <div className="page">
        <h3>Categories</h3>
        {loading ? <p>Loading...</p> : categories.length === 0 ? <p>No categories yet.</p> : (
          <div className="d-flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link key={c._id} className="btn btn-outline-primary" to={`/?category=${encodeURIComponent(c.slug)}`}>{c.name}</Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default Category
