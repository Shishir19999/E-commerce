import { useState } from 'react';
import { AdminLayout, Modal, TextField } from './AdminKit';
import { ErrorState, Skeleton, State } from '../../components/Common';
import { useFetch } from '../../lib/hooks';
import API, { errMsg } from '../../api/client';
import { useUI } from '../../context/UIContext';
import { shortDate } from '../../lib/format';

const blank = { code: '', type: 'percent', value: '', minSubtotal: '', usageLimit: '', expiresAt: '', description: '', active: true };

const AdminCoupons = () => {
  const { toast, confirm } = useUI();
  const { data, loading, error, reload } = useFetch(() => API.get('/api/v1/coupons').then((r) => r.data.coupons), []);
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(f.code.trim())) return setErr('Code must be 3-30 letters, digits, - or _');
    if (!(Number(f.value) > 0) || (f.type === 'percent' && Number(f.value) > 100)) return setErr('Enter a value above 0 (at most 100 for percent)');
    const body = { ...f, code: f.code.trim(), value: Number(f.value), minSubtotal: f.minSubtotal || 0, usageLimit: f.usageLimit || 0, expiresAt: f.expiresAt || '' };
    delete body._id; delete body.used;
    try {
      if (f._id) await API.put(`/api/v1/coupons/${f._id}`, body);
      else await API.post('/api/v1/coupons', body);
      toast.success('Coupon saved');
      setF(null);
      reload();
    } catch (x) {
      setErr(errMsg(x));
    }
  };
  const del = async (c) => {
    if (!(await confirm({ title: `Delete ${c.code}?`, message: 'Customers will no longer be able to use this code.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await API.delete(`/api/v1/coupons/${c._id}`);
      toast.success('Coupon deleted');
      reload();
    } catch (x) {
      toast.error(errMsg(x));
    }
  };
  const toggle = async (c) => {
    try {
      await API.put(`/api/v1/coupons/${c._id}`, { active: !c.active });
      reload();
    } catch (x) {
      toast.error(errMsg(x));
    }
  };

  return (
    <AdminLayout title="Coupons" actions={<button className="btn primary" onClick={() => { setErr(''); setF(blank); }}>+ New coupon</button>}>
      {loading && !data ? <Skeleton h={250} /> : error ? <ErrorState message={error} onRetry={reload} /> : data.length === 0 ? <State icon="🏷️" title="No coupons yet" /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Code</th><th>Discount</th><th>Min. spend</th><th>Used</th><th>Expires</th><th>Active</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{data.map((c) => (
            <tr key={c._id}>
              <td><b>{c.code}</b><div className="muted small">{c.description}</div></td>
              <td>{c.type === 'percent' ? `${c.value}%` : `$${c.value}`}</td><td>{c.minSubtotal ? `$${c.minSubtotal}` : '-'}</td>
              <td>{c.used}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td><td>{c.expiresAt ? shortDate(c.expiresAt) : 'Never'}</td>
              <td><input type="checkbox" aria-label={`${c.code} active`} checked={c.active} onChange={() => toggle(c)} /></td>
              <td style={{ whiteSpace: 'nowrap' }}><button className="btn sm" onClick={() => { setErr(''); setF({ ...blank, ...c, expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '' }); }}>Edit</button> <button className="btn sm danger" onClick={() => del(c)}>Delete</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {f && (
        <Modal title={f._id ? 'Edit coupon' : 'New coupon'} onClose={() => setF(null)}>
          <form onSubmit={save} noValidate>
            <TextField id="cp-code" label="Code" value={f.code} onChange={set('code')} maxLength={30} />
            <div className="grid2">
              <div className="field"><label htmlFor="cp-type">Type</label><select id="cp-type" className="input" value={f.type} onChange={set('type')}><option value="percent">Percent off</option><option value="fixed">Fixed amount off</option></select></div>
              <TextField id="cp-val" label="Value" type="number" min="0" step="0.01" value={f.value} onChange={set('value')} />
              <TextField id="cp-min" label="Minimum spend" type="number" min="0" step="0.01" value={f.minSubtotal} onChange={set('minSubtotal')} />
              <TextField id="cp-lim" label="Usage limit (0 = unlimited)" type="number" min="0" step="1" value={f.usageLimit} onChange={set('usageLimit')} />
            </div>
            <TextField id="cp-exp" label="Expires on (optional)" type="date" value={f.expiresAt} onChange={set('expiresAt')} />
            <TextField id="cp-desc" label="Description" value={f.description} onChange={set('description')} maxLength={200} />
            <label className="row" style={{ marginBottom: 14 }}><input type="checkbox" checked={f.active} onChange={set('active')} /> Active</label>
            {err && <div className="err" role="alert" style={{ marginBottom: 10 }}>{err}</div>}
            <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={() => setF(null)}>Cancel</button><button className="btn primary">Save coupon</button></div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  );
};

export default AdminCoupons;
