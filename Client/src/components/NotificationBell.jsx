import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaBell } from 'react-icons/fa';
import API from '../api/client';
import { useAuth } from '../context/AuthContext';
import { relativeTime } from '../lib/format';

// Loads notifications now, after every navigation and every 30 seconds while signed in.
// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => {
  const { token } = useAuth();
  const loc = useLocation();
  const [state, setState] = useState({ list: [], unread: 0 });
  const load = useCallback(() => {
    if (!token) return Promise.resolve();
    return API.get('/api/v1/notifications')
      .then((r) => setState({ list: r.data.notifications, unread: r.data.unread }))
      .catch(() => {});
  }, [token]);
  useEffect(() => {
    load();
    if (!token) return;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load, token, loc.pathname]);
  const markRead = async (id) => {
    await API.post(`/api/v1/notifications/${id}/read`).catch(() => {});
    load();
  };
  const markAll = async () => {
    await API.post('/api/v1/notifications/read-all').catch(() => {});
    load();
  };
  const clearAll = async () => {
    await API.delete('/api/v1/notifications').catch(() => {});
    load();
  };
  return { ...(token ? state : { list: [], unread: 0 }), reload: load, markRead, markAll, clearAll };
};

export const NotificationBell = () => {
  const { token } = useAuth();
  const n = useNotifications();
  const loc = useLocation();
  const navigate = useNavigate();
  const [openAt, setOpenAt] = useState(null);
  const open = openAt === loc.pathname;
  const ref = useRef(null);
  useEffect(() => {
    const away = (e) => !ref.current?.contains(e.target) && setOpenAt(null);
    const esc = (e) => e.key === 'Escape' && setOpenAt(null);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, []);
  if (!token) return null;
  const go = async (x) => {
    if (!x.read) await n.markRead(x._id);
    setOpenAt(null);
    if (x.link) navigate(x.link);
  };
  return (
    <div className="menu" ref={ref}>
      <button className="icon-btn" aria-label={`Notifications${n.unread ? `, ${n.unread} unread` : ''}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpenAt(open ? null : loc.pathname)}>
        <FaBell />{n.unread > 0 && <span className="badge">{n.unread}</span>}
      </button>
      {open && (
        <div className="menu-pop notif-pop" role="region" aria-label="Notifications">
          <div className="row between" style={{ padding: '4px 10px' }}>
            <b>Notifications</b>
            <button className="btn sm ghost" disabled={n.unread === 0} onClick={n.markAll}>Mark all read</button>
          </div>
          <hr />
          {n.list.length === 0 && <p className="muted small" style={{ padding: '10px 12px', margin: 0 }}>You are all caught up.</p>}
          <ul className="notif-list">
            {n.list.slice(0, 6).map((x) => (
              <li key={x._id}>
                <button className={x.read ? '' : 'unread'} onClick={() => go(x)}>
                  <span>{x.message}</span>
                  <span className="muted small">{relativeTime(x.createdAt)}{!x.read && <span className="sr-only"> (unread)</span>}</span>
                </button>
              </li>
            ))}
          </ul>
          <hr />
          <Link to="/notifications" onClick={() => setOpenAt(null)}>See all notifications</Link>
        </div>
      )}
    </div>
  );
};
