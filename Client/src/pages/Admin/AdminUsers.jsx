import { useState } from 'react';
import { AdminLayout, ExportButton } from './AdminKit';
import { ErrorState, Pager, Skeleton, State } from '../../components/Common';
import { useDebounced, useFetch } from '../../lib/hooks';
import API, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { fetchAll } from '../../lib/csv';
import { ROLE_NAMES } from '../../lib/rules';
import { shortDate } from '../../lib/format';

const TONE = { 0: '', 1: 'info', 2: 'success' };

const AdminUsers = () => {
  const { user: me } = useAuth();
  const { toast, confirm } = useUI();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [applicants, setApplicants] = useState(false);
  const q = useDebounced(search, 250);
  const params = (p, limit) => ({ page: p, limit, search: q, role, sellerRequest: applicants ? 'true' : undefined });
  const { data, loading, error, reload } = useFetch(() => API.get('/api/v1/admin/users', { params: params(page, 10) }).then((r) => r.data), [page, q, role, applicants]);

  const change = async (u, next, title, message) => {
    if (!(await confirm({ title, message, confirmLabel: 'Confirm' }))) return;
    try {
      await API.put(`/api/v1/admin/users/${u._id}/role`, { role: next });
      toast.success('Role updated');
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const del = async (u) => {
    if (!(await confirm({ title: `Delete ${u.name}?`, message: 'The account is removed permanently.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await API.delete(`/api/v1/admin/users/${u._id}`);
      toast.success('User deleted');
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <AdminLayout title="Users" actions={
      <ExportButton
        filename="users.csv"
        load={() => fetchAll((p) => API.get('/api/v1/admin/users', { params: params(p, 100) }).then((r) => r.data), 'users')}
        columns={[['Name', (u) => u.name], ['Email', (u) => u.email], ['Phone', (u) => u.phone], ['Role', (u) => ROLE_NAMES[u.role]], ['Store', (u) => u.storeName || ''], ['Joined', (u) => new Date(u.createdAt).toISOString()]]}
      />}>
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="input" style={{ maxWidth: 300 }} type="search" placeholder="Search name or email" aria-label="Search users" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="input" style={{ width: 'auto' }} aria-label="Filter by role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option><option value="0">Customers</option><option value="2">Sellers</option><option value="1">Admins</option>
        </select>
        <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={applicants} onChange={(e) => { setApplicants(e.target.checked); setPage(1); }} /> Seller applications only</label>
      </div>
      {loading && !data ? <Skeleton h={300} /> : error ? <ErrorState message={error} onRetry={reload} /> : data.users.length === 0 ? <State icon="👥" title="No users found" /> : (
        <>
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{data.users.map((u) => (
              <tr key={u._id}>
                <td>{u.name}{u.storeName && <div className="muted small">{u.storeName}</div>}</td><td>{u.email}</td>
                <td><span className={`pill ${TONE[u.role]}`}>{ROLE_NAMES[u.role]}</span>{u.sellerRequest && <span className="pill warn" style={{ marginLeft: 6 }}>Seller application</span>}</td>
                <td>{shortDate(u.createdAt)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{u._id === me._id ? <span className="muted small">You</span> : (
                  <>
                    {u.sellerRequest && <button className="btn sm primary" onClick={() => change(u, 2, 'Approve seller?', `${u.name} will be able to list products as "${u.storeName}".`)} aria-label={`Approve ${u.name} as a seller`}>Approve seller</button>}{' '}
                    {u.sellerRequest && <button className="btn sm" onClick={() => change(u, 0, 'Decline application?', `${u.name} stays a customer and is told the application was not approved.`)} aria-label={`Decline ${u.name}'s application`}>Decline</button>}{' '}
                    {u.role !== 1 && <button className="btn sm" onClick={() => change(u, 1, 'Make admin?', `${u.name} will be able to manage the whole store.`)}>Make admin</button>}{' '}
                    {u.role === 0 && !u.sellerRequest && <button className="btn sm" onClick={() => change(u, 2, 'Make seller?', `${u.name} will be able to list and fulfil their own products.`)}>Make seller</button>}{' '}
                    {u.role !== 0 && <button className="btn sm" onClick={() => change(u, 0, 'Make customer?', `${u.name} loses ${u.role === 1 ? 'admin' : 'seller'} access and becomes a regular customer.`)}>Make customer</button>}{' '}
                    <button className="btn sm danger" onClick={() => del(u)}>Delete</button>
                  </>
                )}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />
        </>
      )}
    </AdminLayout>
  );
};

export default AdminUsers;
