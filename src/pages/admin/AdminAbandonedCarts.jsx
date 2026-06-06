import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminListDocs } from '../../services/backendApi.js';
import LoadingState from '../../components/LoadingState.jsx';
import { i18n } from '../../i18n';
import AdminPanel from './components/AdminPanel.jsx';
import AdminTable, { AdminTableRow } from './components/AdminTable.jsx';

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
      const snap = await adminListDocs('abandoned_carts/');
      const list = snap.docs.map((d) => {
        const { path, ...rest } = d;
        return { id: d.id, ...rest };
      });
      const ms = (v) => {
        if (v && typeof v.toMillis === 'function') return v.toMillis();
        const time = new Date(v || 0).getTime();
        return Number.isFinite(time) ? time : 0;
      };
      list.sort((a, b) => ms(b.paymentStartedAt) - ms(a.paymentStartedAt));
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

  const tableColumns = [
    { key: 'status', label: t('admin.abandoned.status') },
    { key: 'email', label: t('admin.abandoned.email') },
    { key: 'total', label: t('admin.abandoned.total'), numeric: true },
    { key: 'started', label: t('admin.abandoned.started') },
    { key: 'items', label: t('admin.abandoned.items'), align: 'center' }
  ];

  return (
    <div style={{ display: 'grid', gap: '1.25rem', direction: isAr ? 'rtl' : 'ltr' }}>
      <AdminPanel className="admin-panel--padded">
        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{t('admin.abandoned.heading')}</div>
        <p style={{ margin: '0.45rem 0 0', color: 'var(--admin-muted)', fontSize: '0.9rem' }}>{t('admin.abandoned.blurb')}</p>
        <div className="admin-stat-grid" style={{ marginTop: '1rem' }}>
          <div className="admin-stat-card">
            <div className="admin-stat-card__label">{t('admin.abandoned.awaiting')}</div>
            <div className="admin-stat-card__value">{counts.payment_started}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-card__label">{t('admin.abandoned.reminded')}</div>
            <div className="admin-stat-card__value">{counts.reminder_sent}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-card__label">{t('admin.abandoned.recovered')}</div>
            <div className="admin-stat-card__value">{counts.recovered}</div>
          </div>
        </div>
      </AdminPanel>

      <AdminPanel className="admin-panel--padded">
        <div style={{ fontWeight: 700, marginBottom: '0.85rem' }}>{t('admin.abandoned.list')}</div>
        <AdminTable
          lang={lang}
          columns={tableColumns}
          emptyMessage={t('admin.abandoned.empty')}
        >
          {rows.map((row) => (
            <AdminTableRow key={row.id}>
              <td>{String(row.status || '—')}</td>
              <td>{row.email || '—'}</td>
              <td className="admin-table__cell--numeric">
                {Number(row.total || 0).toFixed(2)} {row.currency || 'BHD'}
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>{formatDate(row.paymentStartedAt)}</td>
              <td className="admin-table__cell--center">{Array.isArray(row.cart) ? row.cart.length : 0}</td>
            </AdminTableRow>
          ))}
        </AdminTable>
      </AdminPanel>
    </div>
  );
};

export default AdminAbandonedCarts;
