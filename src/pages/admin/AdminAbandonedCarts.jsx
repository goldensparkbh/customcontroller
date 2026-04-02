import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import LoadingState from '../../components/LoadingState.jsx';
import { i18n } from '../../i18n';

const sectionStyle = {
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: '10px',
  padding: '1.25rem 1.5rem',
  display: 'grid',
  gap: '1rem'
};

function formatDate(value) {
  if (!value) return '—';
  try {
    if (typeof value.toDate === 'function') return value.toDate().toLocaleString();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  } catch {
    return '—';
  }
}

const AdminAbandonedCarts = ({ lang = 'ar' }) => {
  const isAr = lang === 'ar';
  const t = useCallback(
    (path) => {
      const keys = path.split('.');
      let result = i18n[lang];
      for (const key of keys) {
        if (!result) return path;
        result = result[key];
      }
      return result || path;
    },
    [lang]
  );

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'abandoned_carts'));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.paymentStartedAt?.toMillis?.() || 0;
        const tb = b.paymentStartedAt?.toMillis?.() || 0;
        return tb - ta;
      });
      setRows(list);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { payment_started: 0, reminder_sent: 0, recovered: 0, other: 0 };
    rows.forEach((r) => {
      const s = String(r.status || '');
      if (s in c) c[s] += 1;
      else c.other += 1;
    });
    return c;
  }, [rows]);

  if (loading) {
    return <LoadingState message={isAr ? 'جاري التحميل...' : 'Loading...'} minHeight="32vh" />;
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem', direction: isAr ? 'rtl' : 'ltr' }}>
      <div style={sectionStyle}>
        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{t('admin.abandoned.heading')}</div>
        <p style={{ margin: 0, color: '#8b949e', fontSize: '0.9rem' }}>{t('admin.abandoned.blurb')}</p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.75rem',
            marginTop: '0.5rem'
          }}
        >
          <div style={{ background: '#0d1117', borderRadius: '8px', padding: '0.75rem', border: '1px solid #30363d' }}>
            <div style={{ fontSize: '0.75rem', color: '#8b949e' }}>{t('admin.abandoned.awaiting')}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>{counts.payment_started}</div>
          </div>
          <div style={{ background: '#0d1117', borderRadius: '8px', padding: '0.75rem', border: '1px solid #30363d' }}>
            <div style={{ fontSize: '0.75rem', color: '#8b949e' }}>{t('admin.abandoned.reminded')}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>{counts.reminder_sent}</div>
          </div>
          <div style={{ background: '#0d1117', borderRadius: '8px', padding: '0.75rem', border: '1px solid #30363d' }}>
            <div style={{ fontSize: '0.75rem', color: '#8b949e' }}>{t('admin.abandoned.recovered')}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>{counts.recovered}</div>
          </div>
        </div>
      </div>

      <div style={{ ...sectionStyle, overflowX: 'auto' }}>
        <div style={{ fontWeight: 700 }}>{t('admin.abandoned.list')}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ textAlign: isAr ? 'right' : 'left', color: '#8b949e' }}>
              <th style={{ padding: '0.5rem' }}>{t('admin.abandoned.status')}</th>
              <th style={{ padding: '0.5rem' }}>{t('admin.abandoned.email')}</th>
              <th style={{ padding: '0.5rem' }}>{t('admin.abandoned.total')}</th>
              <th style={{ padding: '0.5rem' }}>{t('admin.abandoned.started')}</th>
              <th style={{ padding: '0.5rem' }}>{t('admin.abandoned.items')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '1rem', color: '#8b949e' }}>
                  {t('admin.abandoned.empty')}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: '1px solid #30363d' }}>
                <td style={{ padding: '0.5rem' }}>{String(row.status || '—')}</td>
                <td style={{ padding: '0.5rem' }}>{row.email || '—'}</td>
                <td style={{ padding: '0.5rem' }}>
                  {Number(row.total || 0).toFixed(2)} {row.currency || 'BHD'}
                </td>
                <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{formatDate(row.paymentStartedAt)}</td>
                <td style={{ padding: '0.5rem' }}>{Array.isArray(row.cart) ? row.cart.length : 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminAbandonedCarts;
