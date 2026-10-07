import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const UIContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useUI = () => useContext(UIContext);

export const UIProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [theme, setThemeState] = useState(() => document.documentElement.getAttribute('data-theme') || 'light');
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useMemo(() => {
    const t = (message, type = 'info') => {
      const id = ++idRef.current;
      setToasts((cur) => [...cur.slice(-3), { id, message, type }]);
      setTimeout(() => dismiss(id), 4200);
    };
    t.success = (m) => t(m, 'success');
    t.error = (m) => t(m, 'error');
    return t;
  }, [dismiss]);

  // resolves true/false
  const confirm = useCallback((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), []);
  const close = useCallback((v) => {
    setDialog((d) => {
      d?.resolve(v);
      return null;
    });
  }, []);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem('theme', t);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo(() => ({ toast, confirm, theme, setTheme }), [toast, confirm, theme, setTheme]);

  return (
    <UIContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.message}</span>
            <button aria-label="Dismiss" onClick={() => dismiss(t.id)}>&times;</button>
          </div>
        ))}
      </div>
      {dialog && <ConfirmDialog {...dialog} onClose={close} />}
    </UIContext.Provider>
  );
};

const ConfirmDialog = ({ title = 'Are you sure?', message, confirmLabel = 'Confirm', danger, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="cd-t" aria-describedby="cd-m">
        <h3 id="cd-t">{title}</h3>
        <p id="cd-m" className="muted">{message}</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" ref={ref} onClick={() => onClose(false)}>Cancel</button>
          <button className={`btn ${danger ? 'danger solid' : 'primary'}`} onClick={() => onClose(true)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};
