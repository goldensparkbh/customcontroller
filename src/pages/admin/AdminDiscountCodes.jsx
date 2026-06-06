import React, { useCallback, useEffect, useState } from 'react';
import { adminDeleteDoc, adminListDocs, adminPatchDoc, adminPutDocData } from '../../services/backendApi.js';
import LoadingState from '../../components/LoadingState.jsx';
import { i18n } from '../../i18n';
import AdminPanel from './components/AdminPanel.jsx';
import AdminTable, { AdminTableRow } from './components/AdminTable.jsx';
import { adminAlign } from './adminUi.js';

const fieldStyle = {
  width: '100%',
  padding: '0.75rem 0.85rem',
  borderRadius: '8px',
  border: '1px solid var(--admin-border)',
  background: 'var(--admin-raised)',
  color: 'var(--admin-text)'
};

/** Light calendar icon on dark inputs (WebKit/Blink); color-scheme helps Firefox. */
const datetimeLocalFieldStyle = {
  ...fieldStyle,
  colorScheme: 'dark'
};

const sectionStyle = {
  background: 'var(--admin-surface)',
  border: '1px solid var(--admin-border)',
  borderRadius: '10px',
  padding: '1.25rem 1.5rem',
  display: 'grid',
  gap: '1rem'
};

function tsToLocalInput(ts) {
  if (!ts) return '';
  const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToTimestamp(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toDateMaybe(value) {
  if (value == null) return null;
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatShortDate(d, isAr) {
  if (!d) return '';
  try {
    return d.toLocaleString(isAr ? 'ar-BH' : 'en-GB', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  } catch {
    return d.toISOString().slice(0, 16);
  }
}

/**
 * @returns {{ used: number, maxUses: number, hasCap: boolean, remaining: number | null, exhausted: boolean, timeStatus: 'expired' | 'not_started' | 'none' | 'valid' }}
 */
function getCodeDerived(row) {
  const now = Date.now();
  const start = toDateMaybe(row.startsAt);
  const end = toDateMaybe(row.endsAt);
  const used = Math.max(0, Number(row.usesCount || 0));
  const maxUses = Math.max(0, Number(row.maxUses || 0));
  const hasCap = maxUses > 0;
  const remaining = hasCap ? Math.max(0, maxUses - used) : null;
  const exhausted = hasCap && used >= maxUses;

  let timeStatus = 'none';
  if (end && now > end.getTime()) timeStatus = 'expired';
  else if (start && now < start.getTime()) timeStatus = 'not_started';
  else if (start || end) timeStatus = 'valid';

  return { used, maxUses, hasCap, remaining, exhausted, timeStatus, start, end };
}

const emptyForm = {
  code: '',
  active: true,
  startsAt: '',
  endsAt: '',
  maxUses: '0',
  discountType: 'percent',
  discountValue: '10',
  description: ''
};

const AdminDiscountCodes = ({ lang = 'ar' }) => {
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');
  const [form, setForm] = useState(emptyForm);
  const [editingCode, setEditingCode] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const resetForm = useCallback(() => {
    setEditingCode('');
    setForm(emptyForm);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setMessage('');
    resetForm();
  }, [resetForm]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await adminListDocs('discount_codes/');
      const list = snap.docs.map((d) => {
        const { path, ...rest } = d;
        return { id: d.id, ...rest };
      });
      list.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      setRows(list);
    } catch (e) {
      console.error(e);
      setMessage(isAr ? 'تعذر تحميل الرموز.' : 'Failed to load codes.');
      setMessageTone('error');
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, closeModal]);

  const openCreateModal = () => {
    resetForm();
    setMessage('');
    setModalOpen(true);
  };

  const startEdit = (row) => {
    const id = String(row.id || row.code || '').toUpperCase();
    setEditingCode(id);
    setForm({
      code: id,
      active: row.active !== false,
      startsAt: tsToLocalInput(row.startsAt),
      endsAt: tsToLocalInput(row.endsAt),
      maxUses: String(row.maxUses != null ? row.maxUses : 0),
      discountType: row.discountType === 'fixed' ? 'fixed' : 'percent',
      discountValue: String(row.discountValue != null ? row.discountValue : ''),
      description: String(row.description || '')
    });
    setMessage('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const code = String(form.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,40}$/i.test(code)) {
      setMessage(isAr ? 'رمز غير صالح (2–40 حرفًا، أحرف وأرقام).' : 'Invalid code (2–40 alphanumeric).');
      setMessageTone('error');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const maxUses = Math.max(0, parseInt(form.maxUses, 10) || 0);
      const discountValue = Number(form.discountValue);
      if (!Number.isFinite(discountValue) || discountValue <= 0) {
        throw new Error('bad_value');
      }
      const existingRow = rows.find((r) => r.id === code);
      const basePayload = {
        code,
        active: Boolean(form.active),
        startsAt: localInputToTimestamp(form.startsAt),
        endsAt: localInputToTimestamp(form.endsAt),
        maxUses,
        discountType: form.discountType === 'fixed' ? 'fixed' : 'percent',
        discountValue,
        description: String(form.description || '').trim(),
        updatedAt: new Date().toISOString()
      };

      if (editingCode && editingCode !== code) {
        await adminDeleteDoc(`discount_codes/${editingCode}`);
      }

      const docPath = `discount_codes/${code}`;
      if (existingRow) {
        await adminPatchDoc(docPath, basePayload);
      } else {
        await adminPutDocData(docPath, { ...basePayload, usesCount: 0 });
      }
      setMessageTone('success');
      setModalOpen(false);
      resetForm();
      await load();
    } catch (err) {
      console.error(err);
      setMessage(isAr ? 'فشل الحفظ.' : 'Save failed.');
      setMessageTone('error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (code) => {
    if (!window.confirm(isAr ? 'حذف هذا الرمز؟' : 'Delete this code?')) return;
    try {
      await adminDeleteDoc(`discount_codes/${code}`);
      await load();
      if (editingCode === code) {
        setModalOpen(false);
        resetForm();
      }
    } catch (e) {
      console.error(e);
      setMessage(isAr ? 'تعذر الحذف.' : 'Delete failed.');
      setMessageTone('error');
    }
  };

  const renderValidityCell = (row) => {
    const d = getCodeDerived(row);
    const parts = [];

    if (d.timeStatus === 'expired') {
      parts.push(
        <span key="exp" style={{ color: '#f85149', fontWeight: 700 }}>
          {t('admin.discounts.expired')}
          {d.end ? ` (${formatShortDate(d.end, isAr)})` : ''}
        </span>
      );
    } else if (d.timeStatus === 'not_started') {
      parts.push(
        <span key="ns" style={{ color: '#d29922', fontWeight: 600 }}>
          {t('admin.discounts.notYetValid')}
          {d.start ? ` — ${t('admin.discounts.from')} ${formatShortDate(d.start, isAr)}` : ''}
        </span>
      );
    } else if (d.timeStatus === 'valid') {
      if (d.end) {
        parts.push(
          <span key="v" style={{ color: '#3fb950' }}>
            {t('admin.discounts.validWindow')} — {t('admin.discounts.until')} {formatShortDate(d.end, isAr)}
          </span>
        );
      } else {
        parts.push(
          <span key="v" style={{ color: '#3fb950' }}>
            {t('admin.discounts.activeSince')} {formatShortDate(d.start, isAr)}
          </span>
        );
      }
    } else {
      parts.push(
        <span key="n" style={{ color: 'var(--admin-muted)' }}>
          {t('admin.discounts.noDateLimits')}
        </span>
      );
    }

    if (d.exhausted) {
      parts.push(
        <div key="ex" style={{ marginTop: '0.25rem', color: '#f85149', fontSize: '0.82rem', fontWeight: 600 }}>
          {t('admin.discounts.exhausted')}
        </div>
      );
    }

    return <div style={{ maxWidth: '220px', lineHeight: 1.45 }}>{parts}</div>;
  };

  if (loading) {
    return <LoadingState message={isAr ? 'جاري التحميل...' : 'Loading...'} minHeight="32vh" />;
  }

  const modalTitle = editingCode ? t('admin.discounts.modalEdit') : t('admin.discounts.modalNew');

  const formBlock = (
    <form onSubmit={handleSave} style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>{t('admin.discounts.code')}</span>
          <input
            style={fieldStyle}
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            disabled={Boolean(editingCode)}
            required
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem', alignItems: 'center' }}>
          <span>{t('admin.discounts.active')}</span>
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>{t('admin.discounts.startsAt')}</span>
          <input
            type="datetime-local"
            className="admin-discount-datetime"
            style={datetimeLocalFieldStyle}
            value={form.startsAt}
            onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>{t('admin.discounts.endsAt')}</span>
          <input
            type="datetime-local"
            className="admin-discount-datetime"
            style={datetimeLocalFieldStyle}
            value={form.endsAt}
            onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>{t('admin.discounts.maxUses')}</span>
          <input
            style={fieldStyle}
            type="number"
            min={0}
            value={form.maxUses}
            onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>{t('admin.discounts.type')}</span>
          <select
            style={fieldStyle}
            value={form.discountType}
            onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value }))}
          >
            <option value="percent">{t('admin.discounts.percent')}</option>
            <option value="fixed">{t('admin.discounts.fixed')}</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>{t('admin.discounts.value')}</span>
          <input
            style={fieldStyle}
            type="number"
            min={0}
            step="0.01"
            value={form.discountValue}
            onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
            required
          />
        </label>
      </div>
      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span>{t('admin.discounts.description')}</span>
        <textarea
          style={{ ...fieldStyle, minHeight: '72px', resize: 'vertical' }}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </label>
      {message && modalOpen && (
        <div style={{ color: messageTone === 'error' ? '#f87171' : '#4ade80', fontSize: '0.9rem' }}>{message}</div>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: isAr ? 'flex-start' : 'flex-end' }}>
        <button
          type="button"
          onClick={closeModal}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '8px',
            border: '1px solid var(--admin-border)',
            background: 'transparent',
            color: 'var(--admin-text)',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {t('admin.discounts.cancel')}
        </button>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '8px',
            border: 'none',
            background: '#238636',
            color: 'var(--admin-on-primary)',
            fontWeight: 700,
            cursor: saving ? 'wait' : 'pointer'
          }}
        >
          {saving ? '…' : t('admin.discounts.save')}
        </button>
      </div>
    </form>
  );

  return (
    <div style={{ display: 'grid', gap: '1.25rem', direction: isAr ? 'rtl' : 'ltr' }}>
      <div
        style={{
          ...sectionStyle,
          display: 'flex',
          flexDirection: isAr ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{t('admin.discounts.heading')}</div>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--admin-muted)', fontSize: '0.9rem' }}>{t('admin.discounts.blurb')}</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          style={{
            padding: '0.7rem 1.15rem',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--button-primary-bg, #238636)',
            color: 'var(--admin-text-strong)',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          + {t('admin.discounts.addCode')}
        </button>
      </div>

      {message && !modalOpen && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: '#1c2128',
            border: `1px solid ${messageTone === 'error' ? '#f85149' : '#238636'}`,
            color: messageTone === 'error' ? '#f87171' : '#4ade80',
            fontSize: '0.9rem'
          }}
        >
          {message}
        </div>
      )}

      <AdminPanel className="admin-panel--padded">
        <div style={{ fontWeight: 700, marginBottom: '0.85rem' }}>{t('admin.discounts.list')}</div>
        <AdminTable
          lang={lang}
          columns={[
            { key: 'code', label: t('admin.discounts.code') },
            { key: 'active', label: t('admin.discounts.active'), align: 'center' },
            { key: 'type', label: t('admin.discounts.type') },
            { key: 'value', label: t('admin.discounts.value'), numeric: true },
            { key: 'used', label: t('admin.discounts.used'), numeric: true },
            { key: 'left', label: t('admin.discounts.left'), numeric: true },
            { key: 'validity', label: t('admin.discounts.validity') },
            { key: 'actions', label: '' }
          ]}
          emptyMessage={t('admin.discounts.empty')}
        >
          {rows.map((row) => {
            const d = getCodeDerived(row);
            const leftDisplay =
              d.remaining == null ? (
                <span style={{ color: 'var(--admin-muted)' }}>{t('admin.discounts.unlimited')}</span>
              ) : (
                <span style={{ color: d.remaining === 0 ? '#f85149' : 'var(--admin-text)', fontWeight: d.remaining === 0 ? 700 : 400 }}>
                  {d.remaining}
                  {d.hasCap ? ` / ${d.maxUses}` : ''}
                </span>
              );
            const dateExpired = d.timeStatus === 'expired';
            const notUsable = dateExpired || d.exhausted || row.active === false;

            return (
              <AdminTableRow key={row.id} dimmed={notUsable}>
                <td style={{ fontWeight: 600 }}>{row.id}</td>
                <td className="admin-table__cell--center">{row.active === false ? '—' : '✓'}</td>
                <td>{row.discountType === 'fixed' ? t('admin.discounts.fixed') : t('admin.discounts.percent')}</td>
                <td className="admin-table__cell--numeric">{row.discountValue}</td>
                <td className="admin-table__cell--numeric">{d.used}</td>
                <td className="admin-table__cell--numeric">{leftDisplay}</td>
                <td>{renderValidityCell(row)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" onClick={() => startEdit(row)} className="admin-btn admin-btn--ghost" style={{ padding: '0.25rem 0.5rem', color: '#58a6ff' }}>
                    {t('admin.discounts.edit')}
                  </button>
                  <button type="button" onClick={() => handleDelete(row.id)} className="admin-btn admin-btn--ghost" style={{ padding: '0.25rem 0.5rem', color: '#f85149' }}>
                    {t('admin.discounts.delete')}
                  </button>
                </td>
              </AdminTableRow>
            );
          })}
        </AdminTable>
      </AdminPanel>

      {modalOpen && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            direction: isAr ? 'rtl' : 'ltr'
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="discount-modal-title"
            style={{
              width: '100%',
              maxWidth: '640px',
              maxHeight: 'min(90vh, 900px)',
              overflow: 'auto',
              background: 'var(--admin-surface)',
              border: '1px solid var(--admin-border)',
              borderRadius: '12px',
              padding: '1.35rem 1.5rem',
              boxShadow: '0 24px 80px rgba(0,0,0,0.45)'
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <style>
              {`
                .admin-discount-datetime::-webkit-calendar-picker-indicator {
                  filter: invert(1) brightness(1.15);
                  cursor: pointer;
                  opacity: 1;
                }
                .admin-discount-datetime::-webkit-calendar-picker-indicator:hover {
                  filter: invert(1) brightness(1.35);
                }
              `}
            </style>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
              <h2 id="discount-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                {modalTitle}
              </h2>
              <button
                type="button"
                aria-label={t('admin.discounts.closeModal')}
                onClick={closeModal}
                style={{
                  flexShrink: 0,
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: '1px solid var(--admin-border)',
                  background: 'var(--admin-raised)',
                  color: 'var(--admin-text)',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>
            {formBlock}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDiscountCodes;
