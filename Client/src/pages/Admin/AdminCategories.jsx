import { useState } from 'react';
import { AdminLayout, Modal, TextField } from './AdminKit';
import { ErrorState, Skeleton, State } from '../../components/Common';
import { useFetch } from '../../lib/hooks';
import API, { errMsg } from '../../api/client';
import { useUI } from '../../context/UIContext';

const AdminCategories = () => {
  const { toast, confirm } = useUI();
  const { data, loading, error, reload } = useFetch(() => API.get('/api/v1/categories').then((r) => r.data.categories), []);
  const [edit, setEdit] = useState(null); // { _id?, name }
  const [err, setErr] = useState('');

  const save = async (e) => {
    e.preventDefault();
    if (!edit.name.trim()) return setErr('Enter a category name');
    try {
      if (edit._id) await API.put(`/api/v1/categories/${edit._id}`, { name: edit.name });
      else await API.post('/api/v1/categories', { name: edit.name });
      toast.success('Category saved');
      setEdit(null);
      setErr('');
      reload();
    } catch (x) {
      setErr(errMsg(x));
    }
  };
  const del = async (c) => {
    if (!(await confirm({ title: `Delete "${c.name}"?`, message: 'Categories that still contain products cannot be deleted.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await API.delete(`/api/v1/categories/${c._id}`);
      toast.success('Category deleted');
      reload();
    } catch (x) {
      toast.error(errMsg(x));
    }
  };

  return (
    <AdminLayout title="Categories" actions={<button className="btn primary" onClick={() => { setErr(''); setEdit({ name: '' }); }}>+ New category</button>}>
      {loading && !data ? <Skeleton h={200} /> : error ? <ErrorState message={error} onRetry={reload} /> : data.length === 0 ? <State icon="🗂️" title="No categories yet" /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Slug</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{data.map((c) => <tr key={c._id}><td>{c.name}</td><td className="muted">{c.slug}</td><td style={{ whiteSpace: 'nowrap' }}><button className="btn sm" onClick={() => { setErr(''); setEdit(c); }}>Rename</button> <button className="btn sm danger" onClick={() => del(c)}>Delete</button></td></tr>)}</tbody>
        </table></div>
      )}
      {edit && (
        <Modal title={edit._id ? 'Rename category' : 'New category'} onClose={() => setEdit(null)}>
          <form onSubmit={save} noValidate>
            <TextField id="cat-name" label="Name" value={edit.name} error={err} maxLength={60} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary">Save</button></div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  );
};

export default AdminCategories;
