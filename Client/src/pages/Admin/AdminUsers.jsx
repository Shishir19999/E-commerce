import { useState } from 'react';
import { AdminLayout } from './AdminKit';
import { ErrorState, Pager, Skeleton, State } from '../../components/Common';
import { useDebounced, useFetch } from '../../lib/hooks';
import API, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { shortDate } from '../../lib/format';

const AdminUsers = () => {
  const { user: me } = useAuth();
  const { toast, confirm } = useUI();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 250);
  const { data, loading, error, reload } = useFetch(() => API.get('/api/v1/admin/users', { params: { page, limit: 10, search: q } }).then((r) => r.data), [page, q]);

  const setRole = async (u) => {
    const role = u.role === 1 ? 0 : 1;
    if (!(await confirm({ title: role ? 'Make admin?' : 'Remove admin rights?', message: `${u.name} will ${role ? 'be able to manage the store' : 'become a regular customer'}.`, confirmLabel: 'Confirm' }))) return;
    try {
      await API.put(`/api/v1/admin/users/${u._id}/role`, { role });
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
    <AdminLayout title="Users">
      <input className="input" style={{ marginBottom: 12, maxWidth: 320 }} type="search" placeholder="Search name or email" aria-label="Search users" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      {loading && !data ? <Skeleton h={300} /> : error ? <ErrorState message={error} onRetry={reload} /> : data.users.length === 0 ? <State icon="👥" title="No users found" /> : (
        <>
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{data.users.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td><td>{u.email}</td><td><span className={`pill ${u.role === 1 ? 'info' : ''}`}>{u.role === 1 ? 'Admin' : 'Customer'}</span></td><td>{shortDate(u.createdAt)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{u._id === me._id ? <span className="muted small">You</span> : <><button className="btn sm" onClick={() => setRole(u)}>{u.role === 1 ? 'Remove admin' : 'Make admin'}</button> <button className="btn sm danger" onClick={() => del(u)}>Delete</button></>}</td>
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
