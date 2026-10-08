import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { State } from '../components/Common';
import { useNotifications } from '../components/NotificationBell';
import { relativeTime } from '../lib/format';

const ICON = { order: '📦', return: '↩️', stock: '⚠️', review: '⭐', seller: '🏪', info: '🔔' };

const Notifications = () => {
  const n = useNotifications();
  const navigate = useNavigate();
  const go = async (x) => {
    if (!x.read) await n.markRead(x._id);
    if (x.link) navigate(x.link);
  };
  return (
    <Layout title="Notifications">
      <div className="container page" style={{ maxWidth: 760 }}>
        <div className="row between">
          <h1 style={{ fontSize: '1.9rem' }}>Notifications</h1>
          <span className="row">
            <button className="btn sm" disabled={n.unread === 0} onClick={n.markAll}>Mark all read</button>
            <button className="btn sm danger" disabled={n.list.length === 0} onClick={n.clearAll}>Clear all</button>
          </span>
        </div>
        {n.list.length === 0 ? (
          <State icon="🔔" title="You are all caught up">Order updates, returns and stock alerts will show up here.</State>
        ) : (
          <ul className="notif-page card" aria-label="All notifications">
            {n.list.map((x) => (
              <li key={x._id}>
                <button className={x.read ? '' : 'unread'} onClick={() => go(x)}>
                  <span aria-hidden="true" className="ico">{ICON[x.type] || ICON.info}</span>
                  <span className="grow">{x.message}{!x.read && <span className="sr-only"> (unread)</span>}</span>
                  <span className="muted small">{relativeTime(x.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
};

export default Notifications;
