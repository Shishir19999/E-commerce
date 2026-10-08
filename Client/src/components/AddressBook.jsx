import { useState } from 'react';
import API, { errMsg } from '../api/client';
import { useFetch } from '../lib/hooks';
import { useUI } from '../context/UIContext';
import { validateAddress } from '../lib/rules';
import { ErrorState, Skeleton } from './Common';
import { Modal } from '../pages/Admin/AdminKit';

const blank = { label: '', name: '', phone: '', street: '', city: '', zip: '', isDefault: false };

const AddressForm = ({ initial, onSaved, onClose }) => {
  const { toast } = useUI();
  const [f, setF] = useState(initial);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const field = (k, label, props = {}) => (
    <div className="field">
      <label htmlFor={`ab-${k}`}>{label}</label>
      <input id={`ab-${k}`} className="input" value={f[k]} aria-invalid={Boolean(errs[k])} aria-describedby={errs[k] ? `ab-${k}-e` : undefined} onChange={set(k)} {...props} />
      {errs[k] && <span className="err" id={`ab-${k}-e`} role="alert">{errs[k]}</span>}
    </div>
  );
  const submit = async (e) => {
    e.preventDefault();
    const n = validateAddress(f);
    setErrs(n);
    if (Object.keys(n).length) return;
    setBusy(true);
    try {
      if (initial._id) await API.put(`/api/v1/auth/addresses/${initial._id}`, f);
      else await API.post('/api/v1/auth/addresses', f);
      toast.success(initial._id ? 'Address updated' : 'Address saved');
      onSaved();
    } catch (err) {
      setErrs({ form: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={initial._id ? 'Edit address' : 'Add an address'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {field('label', 'Label (for example Home or Work)', { maxLength: 30 })}
        <div className="grid2">{field('name', 'Full name', { autoComplete: 'name' })}{field('phone', 'Phone', { autoComplete: 'tel' })}</div>
        {field('street', 'Street address', { autoComplete: 'street-address' })}
        <div className="grid2">{field('city', 'City', { autoComplete: 'address-level2' })}{field('zip', 'Postal code', { autoComplete: 'postal-code' })}</div>
        <label className="row" style={{ marginBottom: 14 }}><input type="checkbox" checked={f.isDefault} onChange={set('isDefault')} /> Use as my default address</label>
        {errs.form && <div className="err" role="alert" style={{ marginBottom: 10 }}>{errs.form}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save address'}</button></div>
      </form>
    </Modal>
  );
};

export const AddressBook = ({ defaults }) => {
  const { toast, confirm } = useUI();
  const [editing, setEditing] = useState(null);
  const { data, loading, error, reload } = useFetch(() => API.get('/api/v1/auth/addresses').then((r) => r.data.addresses), []);
  const remove = async (a) => {
    if (!(await confirm({ title: 'Remove this address?', message: `${a.label || 'This address'} will be deleted from your address book.`, confirmLabel: 'Remove', danger: true }))) return;
    try {
      await API.delete(`/api/v1/auth/addresses/${a._id}`);
      toast.success('Address removed');
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const makeDefault = async (a) => {
    try {
      await API.put(`/api/v1/auth/addresses/${a._id}`, { ...a, isDefault: true });
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <section className="card" aria-labelledby="ab-h" style={{ marginTop: 20 }}>
      <div className="row between"><h2 id="ab-h" style={{ fontSize: '1.3rem', margin: 0 }}>Address book</h2><button className="btn sm primary" onClick={() => setEditing({ ...blank, ...defaults })}>+ Add address</button></div>
      {loading && !data ? <Skeleton h={80} style={{ marginTop: 12 }} /> : error ? <ErrorState message={error} onRetry={reload} /> : data.length === 0 ? (
        <p className="muted">No saved addresses yet. Add one to check out faster.</p>
      ) : (
        <ul className="addr-list">
          {data.map((a) => (
            <li key={a._id}>
              <div>
                <b>{a.label || 'Address'}</b>{a.isDefault && <span className="pill info" style={{ marginLeft: 8 }}>Default</span>}
                <div className="muted small">{a.name}, {a.street}, {a.city} {a.zip} &middot; {a.phone}</div>
              </div>
              <span className="row" style={{ gap: 6 }}>
                {!a.isDefault && <button className="btn sm" onClick={() => makeDefault(a)} aria-label={`Make ${a.label || 'this address'} the default`}>Make default</button>}
                <button className="btn sm" onClick={() => setEditing(a)} aria-label={`Edit ${a.label || 'address'}`}>Edit</button>
                <button className="btn sm danger" onClick={() => remove(a)} aria-label={`Remove ${a.label || 'address'}`}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {editing && <AddressForm key={editing._id || 'new'} initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </section>
  );
};
