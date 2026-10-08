import { useState } from 'react';
import { parseVariants } from './variants';
import { AdminLayout, ExportButton, Modal, TextField } from './AdminKit';
import { ErrorState, Img, Pager, Skeleton, State } from '../../components/Common';
import { useDebounced, useFetch } from '../../lib/hooks';
import API, { errMsg } from '../../api/client';
import { useUI } from '../../context/UIContext';
import { fetchAll } from '../../lib/csv';
import { LOW_STOCK, money, sellerName } from '../../lib/format';

const empty = { name: '', description: '', price: '', compareAtPrice: '', quantity: '', category: '', photo: '', images: '', variants: '', featured: false };

const variantsText = (v = []) => v.map((g) => `${g.name}: ${g.options.join(', ')}`).join(' | ');

const ProductForm = ({ initial, categories, onSaved, onClose, seller }) => {
  const { toast } = useUI();
  const [f, setF] = useState(initial);
  const [file, setFile] = useState(null);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const n = {};
    if (!f.name.trim()) n.name = 'Name is required';
    if (!f.description.trim()) n.description = 'Description is required';
    if (f.price === '' || Number(f.price) < 0) n.price = 'Enter a price of 0 or more';
    if (f.quantity === '' || !Number.isInteger(Number(f.quantity)) || Number(f.quantity) < 0) n.quantity = 'Enter a whole number of 0 or more';
    if (!f.category) n.category = 'Choose a category';
    if (file && file.size > 250 * 1024) n.photo = 'Upload must be 250 KB or smaller';
    const variants = parseVariants(f.variants);
    if (variants.some((v) => !v.name || v.options.length === 0)) n.variants = 'Use the format: Color: Black, White | Size: S, M';
    setErrs(n);
    if (Object.keys(n).length) return;
    const fd = new FormData();
    ['name', 'description', 'price', 'compareAtPrice', 'quantity', 'category'].forEach((k) => fd.append(k, f[k]));
    fd.append('featured', String(f.featured));
    fd.append('variants', JSON.stringify(variants));
    fd.append('images', JSON.stringify(f.images.split('\n').map((x) => x.trim()).filter(Boolean)));
    if (file) fd.append('photo', file);
    else fd.append('photo', f.photo);
    setBusy(true);
    try {
      if (initial._id) await API.put(`/api/v1/products/${initial._id}`, fd);
      else await API.post('/api/v1/products', fd);
      toast.success(initial._id ? 'Product updated' : 'Product created');
      onSaved();
    } catch (err) {
      setErrs({ form: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={initial._id ? 'Edit product' : 'New product'} onClose={onClose} wide>
      <form onSubmit={submit} noValidate>
        <TextField id="pf-name" label="Name" value={f.name} error={errs.name} onChange={set('name')} maxLength={120} />
        <TextField id="pf-desc" as="textarea" rows="3" label="Description" value={f.description} error={errs.description} onChange={set('description')} maxLength={2000} />
        <div className="grid3">
          <TextField id="pf-price" label="Price" type="number" min="0" step="0.01" value={f.price} error={errs.price} onChange={set('price')} />
          <TextField id="pf-cmp" label="Compare-at price" type="number" min="0" step="0.01" value={f.compareAtPrice} onChange={set('compareAtPrice')} hint="Shows a discount badge" />
          <TextField id="pf-qty" label="Stock" type="number" min="0" step="1" value={f.quantity} error={errs.quantity} onChange={set('quantity')} />
        </div>
        <div className="field">
          <label htmlFor="pf-cat">Category</label>
          <select id="pf-cat" className="input" value={f.category} aria-invalid={Boolean(errs.category)} onChange={set('category')}>
            <option value="">Select a category</option>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          {errs.category && <span className="err" role="alert">{errs.category}</span>}
        </div>
        <TextField id="pf-var" label="Variants" placeholder="Color: Black, White | Size: S, M" value={f.variants} error={errs.variants} onChange={set('variants')} />
        <TextField id="pf-photo" label="Main image URL" type="url" placeholder="https://..." value={f.photo.startsWith('art:') ? '' : f.photo} onChange={set('photo')} hint={f.photo.startsWith('art:') ? 'Currently using bundled artwork. Enter a URL or upload to replace it.' : undefined} />
        <TextField id="pf-file" label="Or upload an image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" error={errs.photo} onChange={(e) => setFile(e.target.files[0] || null)} hint="Up to 250 KB in the live preview" />
        <TextField id="pf-imgs" as="textarea" rows="2" label="Extra gallery image URLs (one per line)" value={f.images} onChange={set('images')} />
        {!seller && <label className="row" style={{ marginBottom: 14 }}><input type="checkbox" checked={f.featured} onChange={set('featured')} /> Featured on the home page</label>}
        {errs.form && <div className="err" role="alert" style={{ marginBottom: 10 }}>{errs.form}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button></div>
      </form>
    </Modal>
  );
};

const AdminProducts = ({ seller = false }) => {
  const { toast, confirm } = useUI();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 250);
  const [editing, setEditing] = useState(null);
  const cats = useFetch(() => API.get('/api/v1/categories').then((r) => r.data.categories), []);
  const { data, loading, error, reload } = useFetch(() => API.get(seller ? '/api/v1/seller/products' : '/api/v1/products', { params: { page, limit: 10, search: q, sort: 'newest' } }).then((r) => r.data), [page, q, seller]);

  const edit = (p) => setEditing({ ...empty, ...p, price: String(p.price), compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : '', quantity: String(p.quantity), category: p.category?._id || '', photo: p.photo || '', images: (p.images || []).join('\n'), variants: variantsText(p.variants) });
  const del = async (p) => {
    if (!(await confirm({ title: `Delete "${p.name}"?`, message: 'The product and its reviews are removed.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await API.delete(`/api/v1/products/${p._id}`);
      toast.success('Product deleted');
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <AdminLayout title={seller ? 'My products' : 'Products'} seller={seller} actions={
      <span className="row">
        <ExportButton
          filename={seller ? 'my-products.csv' : 'products.csv'}
          load={() => fetchAll((p) => API.get(seller ? '/api/v1/seller/products' : '/api/v1/products', { params: { page: p, limit: seller ? 100 : 60, search: q, sort: 'newest' } }).then((r) => r.data), 'products')}
          columns={[['Name', (p) => p.name], ['Category', (p) => p.category?.name || ''], ['Seller', (p) => sellerName(p.seller)], ['Price', (p) => p.price], ['Compare at', (p) => p.compareAtPrice || ''], ['Stock', (p) => p.quantity], ['Units sold', (p) => p.sold], ['Rating', (p) => p.rating], ['Reviews', (p) => p.numReviews]]}
        />
        <button className="btn primary" onClick={() => setEditing(empty)}>+ New product</button>
      </span>}>
      <input className="input" style={{ marginBottom: 12, maxWidth: 320 }} type="search" placeholder="Search products" aria-label="Search products" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      {loading && !data ? <Skeleton h={300} /> : error ? <ErrorState message={error} onRetry={reload} /> : data.products.length === 0 ? <State icon="📦" title="No products found" action={<button className="btn primary" onClick={() => setEditing(empty)}>Add your first product</button>} /> : (
        <>
          <div className="table-wrap"><table>
            <thead><tr><th></th><th>Name</th><th>Category</th>{!seller && <th>Seller</th>}<th>Price</th><th>Stock</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{data.products.map((p) => (
              <tr key={p._id}>
                <td><Img className="thumb" photo={p.photo} name="" /></td>
                <td>{p.name}{p.featured && <span className="pill info" style={{ marginLeft: 6 }}>Featured</span>}</td>
                <td>{p.category?.name}</td>{!seller && <td>{sellerName(p.seller)}</td>}<td>{money(p.price)}</td>
                <td><span className={`pill ${p.quantity === 0 ? 'danger' : p.quantity <= LOW_STOCK ? 'warn' : ''}`}>{p.quantity}{p.quantity <= LOW_STOCK && <span className="sr-only"> (low stock)</span>}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}><button className="btn sm" onClick={() => edit(p)}>Edit</button> <button className="btn sm danger" onClick={() => del(p)}>Delete</button></td>
              </tr>
            ))}</tbody>
          </table></div>
          <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />
        </>
      )}
      {editing && <ProductForm seller={seller} key={editing._id || 'new'} initial={editing} categories={cats.data || []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </AdminLayout>
  );
};

export default AdminProducts;
