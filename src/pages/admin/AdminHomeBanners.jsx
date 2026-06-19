import React, { useCallback, useEffect, useRef, useState } from 'react';
import LoadingState from '../../components/LoadingState.jsx';
import { adminUploadFile } from '../../services/backendApi.js';
import { i18n } from '../../i18n';
import AdminPanel from './components/AdminPanel.jsx';
import {
  createEmptyBanner,
  getDefaultHomeBanners,
  loadHomeBanners,
  moveBanner,
  saveHomeBanners,
} from './homeBanners.js';
import {
  DEFAULT_BANNER_DURATION_MS,
  MAX_BANNER_DURATION_MS,
  MIN_BANNER_DURATION_MS,
  normalizeDurationMs,
} from '../../lib/homeBanners.js';

const fieldStyle = {
  width: '100%',
  padding: '0.75rem 0.85rem',
  borderRadius: '8px',
  border: '1px solid var(--admin-border)',
  background: 'var(--admin-raised)',
  color: 'var(--admin-text)',
};

const sectionStyle = {
  background: 'var(--admin-surface)',
  border: '1px solid var(--admin-border)',
  borderRadius: '10px',
  padding: '1.25rem 1.5rem',
  display: 'grid',
  gap: '1rem',
};

const actionBtn = {
  padding: '0.45rem 0.75rem',
  borderRadius: '8px',
  border: '1px solid var(--admin-border-strong)',
  background: 'var(--admin-hover)',
  color: 'var(--admin-text)',
  cursor: 'pointer',
  fontSize: '0.82rem',
};

const primaryBtn = {
  ...actionBtn,
  background: 'var(--button-primary-bg)',
  color: 'var(--button-primary-text)',
  border: 'none',
  fontWeight: 700,
};

function BannerPreview({ banner, isAr }) {
  const hasImage = Boolean(banner.imageUrl);
  return (
    <div
      className={`home-banner-slide home-banner-slide--${banner.accent}${hasImage ? ' home-banner-slide--has-image' : ''}`}
      style={hasImage ? { backgroundImage: `url("${banner.imageUrl}")` } : undefined}
    >
      <div className="home-banner-glow" aria-hidden="true" />
      {hasImage ? <div className="home-banner-image-overlay" aria-hidden="true" /> : null}
      <p className="home-banner-eyebrow">{banner.eyebrow || 'Custom Controller'}</p>
      <h2 className="home-banner-title">{banner.title || (isAr ? 'عنوان البانر' : 'Banner title')}</h2>
      <p className="home-banner-sub">{banner.subtitle || (isAr ? 'وصف البانر' : 'Banner description')}</p>
      {banner.linkUrl ? (
        <span className="home-banner-link-preview">{banner.linkLabel || banner.linkUrl}</span>
      ) : null}
    </div>
  );
}

const AdminHomeBanners = ({ lang = 'ar' }) => {
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

  const [activeLocale, setActiveLocale] = useState('ar');
  const [bannersByLocale, setBannersByLocale] = useState({ ar: [], en: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');
  const fileInputs = useRef(new Map());

  const rows = bannersByLocale[activeLocale] || [];

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await loadHomeBanners();
      setBannersByLocale({ ar: data.ar, en: data.en });
    } catch (error) {
      console.error(error);
      setMessage(t('admin.homeBanners.loadError'));
      setMessageTone('error');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const patchRows = (locale, nextRows) => {
    setBannersByLocale((prev) => ({ ...prev, [locale]: nextRows }));
  };

  const patchRow = (locale, id, field, value) => {
    setBannersByLocale((prev) => ({
      ...prev,
      [locale]: (prev[locale] || []).map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    }));
  };

  const addRow = () => {
    const locale = activeLocale;
    setBannersByLocale((prev) => ({
      ...prev,
      [locale]: [...(prev[locale] || []), createEmptyBanner(prev[locale] || [], locale)],
    }));
  };

  const removeRow = (id) => {
    const locale = activeLocale;
    const current = bannersByLocale[locale] || [];
    if (!window.confirm(t('admin.homeBanners.deleteConfirm'))) return;
    patchRows(locale, current.filter((row) => row.id !== id).map((row, index) => ({ ...row, sortOrder: index })));
  };

  const moveRow = (index, delta) => {
    const locale = activeLocale;
    patchRows(locale, moveBanner(bannersByLocale[locale] || [], index, delta));
  };

  const triggerUpload = (id) => {
    const input = fileInputs.current.get(id);
    if (input) input.click();
  };

  const handleImageUpload = async (rowId, file) => {
    if (!file) return;
    setUploadingId(rowId);
    setMessage('');
    try {
      const { url } = await adminUploadFile(file);
      patchRow(activeLocale, rowId, 'imageUrl', url);
      setMessage(t('admin.homeBanners.uploaded'));
      setMessageTone('success');
    } catch (error) {
      console.error(error);
      setMessage(t('admin.homeBanners.uploadError'));
      setMessageTone('error');
    } finally {
      setUploadingId('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await saveHomeBanners(bannersByLocale);
      setMessage(t('admin.homeBanners.saved'));
      setMessageTone('success');
    } catch (error) {
      console.error(error);
      setMessage(t('admin.homeBanners.saveError'));
      setMessageTone('error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (!window.confirm(t('admin.homeBanners.resetConfirm'))) return;
    setBannersByLocale((prev) => ({
      ...prev,
      [activeLocale]: getDefaultHomeBanners(activeLocale),
    }));
    setMessage(t('admin.homeBanners.resetDone'));
    setMessageTone('success');
  };

  if (loading) {
    return <LoadingState message={t('admin.homeBanners.loading')} />;
  }

  return (
    <AdminPanel>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <p style={{ margin: 0, opacity: 0.82, lineHeight: 1.6 }}>{t('admin.homeBanners.blurb')}</p>

        {message ? (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: `1px solid ${messageTone === 'error' ? 'rgba(232,72,106,0.45)' : 'rgba(47,159,255,0.35)'}`,
              background: messageTone === 'error' ? 'rgba(232,72,106,0.12)' : 'rgba(47,159,255,0.12)',
            }}
          >
            {message}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'inline-flex', borderRadius: '999px', border: '1px solid var(--admin-border)', overflow: 'hidden' }}>
            {['ar', 'en'].map((locale) => (
              <button
                key={locale}
                type="button"
                onClick={() => setActiveLocale(locale)}
                style={{
                  ...actionBtn,
                  border: 'none',
                  borderRadius: 0,
                  background: activeLocale === locale ? 'var(--button-primary-bg)' : 'transparent',
                  color: activeLocale === locale ? 'var(--button-primary-text)' : 'var(--admin-text)',
                  fontWeight: activeLocale === locale ? 700 : 500,
                }}
              >
                {locale === 'ar' ? t('admin.homeBanners.tabAr') : t('admin.homeBanners.tabEn')}
              </button>
            ))}
          </div>

          <button type="button" style={actionBtn} onClick={addRow}>{t('admin.homeBanners.add')}</button>
          <button type="button" style={actionBtn} onClick={handleResetDefaults}>{t('admin.homeBanners.resetLocale')}</button>
          <button type="button" style={primaryBtn} onClick={handleSave} disabled={saving}>
            {saving ? t('admin.homeBanners.saving') : t('admin.homeBanners.save')}
          </button>
        </div>

        {!rows.length ? (
          <div style={sectionStyle}>
            <p style={{ margin: 0 }}>{t('admin.homeBanners.empty')}</p>
          </div>
        ) : null}

        {rows.map((row, index) => (
          <div key={row.id} style={sectionStyle}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{t('admin.homeBanners.bannerLabel')} {index + 1}</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={row.enabled !== false}
                    onChange={(e) => patchRow(activeLocale, row.id, 'enabled', e.target.checked)}
                  />
                  {t('admin.homeBanners.enabled')}
                </label>
                <button type="button" style={actionBtn} onClick={() => moveRow(index, -1)} disabled={index === 0}>↑</button>
                <button type="button" style={actionBtn} onClick={() => moveRow(index, 1)} disabled={index === rows.length - 1}>↓</button>
                <button type="button" style={actionBtn} onClick={() => removeRow(row.id)}>{t('admin.homeBanners.delete')}</button>
              </div>
            </div>

            <div className="admin-home-banner-grid" style={{ display: 'grid', gap: '1.25rem', alignItems: 'start' }}>
              <div style={{ display: 'grid', gap: '0.85rem' }}>
                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span>{t('admin.homeBanners.eyebrow')}</span>
                  <input
                    style={fieldStyle}
                    value={row.eyebrow || ''}
                    onChange={(e) => patchRow(activeLocale, row.id, 'eyebrow', e.target.value)}
                  />
                </label>

                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span>{t('admin.homeBanners.title')}</span>
                  <input
                    style={fieldStyle}
                    value={row.title || ''}
                    onChange={(e) => patchRow(activeLocale, row.id, 'title', e.target.value)}
                  />
                </label>

                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span>{t('admin.homeBanners.subtitle')}</span>
                  <textarea
                    style={{ ...fieldStyle, minHeight: '84px', resize: 'vertical' }}
                    value={row.subtitle || ''}
                    onChange={(e) => patchRow(activeLocale, row.id, 'subtitle', e.target.value)}
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <label style={{ display: 'grid', gap: '0.35rem' }}>
                    <span>{t('admin.homeBanners.accent')}</span>
                    <select
                      style={fieldStyle}
                      value={row.accent || 'cyan'}
                      onChange={(e) => patchRow(activeLocale, row.id, 'accent', e.target.value)}
                    >
                      <option value="cyan">{t('admin.homeBanners.accentCyan')}</option>
                      <option value="pink">{t('admin.homeBanners.accentPink')}</option>
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: '0.35rem' }}>
                    <span>{t('admin.homeBanners.duration')}</span>
                    <input
                      style={fieldStyle}
                      type="number"
                      min={MIN_BANNER_DURATION_MS / 1000}
                      max={MAX_BANNER_DURATION_MS / 1000}
                      step={0.5}
                      value={(normalizeDurationMs(row.durationMs) / 1000).toFixed(1).replace(/\.0$/, '')}
                      onChange={(e) => {
                        const seconds = Number(e.target.value);
                        patchRow(
                          activeLocale,
                          row.id,
                          'durationMs',
                          normalizeDurationMs(Number.isFinite(seconds) ? seconds * 1000 : DEFAULT_BANNER_DURATION_MS)
                        );
                      }}
                    />
                    <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>{t('admin.homeBanners.durationHint')}</span>
                  </label>
                </div>

                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span>{t('admin.homeBanners.linkUrl')}</span>
                  <input
                    style={fieldStyle}
                    value={row.linkUrl || ''}
                    onChange={(e) => patchRow(activeLocale, row.id, 'linkUrl', e.target.value)}
                    placeholder="https://"
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                  <label style={{ display: 'grid', gap: '0.35rem' }}>
                    <span>{t('admin.homeBanners.linkLabel')}</span>
                    <input
                      style={fieldStyle}
                      value={row.linkLabel || ''}
                      onChange={(e) => patchRow(activeLocale, row.id, 'linkLabel', e.target.value)}
                    />
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', paddingBottom: '0.7rem' }}>
                    <input
                      type="checkbox"
                      checked={row.linkNewTab === true}
                      onChange={(e) => patchRow(activeLocale, row.id, 'linkNewTab', e.target.checked)}
                    />
                    {t('admin.homeBanners.linkNewTab')}
                  </label>
                </div>

                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <span>{t('admin.homeBanners.image')}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      style={actionBtn}
                      onClick={() => triggerUpload(row.id)}
                      disabled={uploadingId === row.id}
                    >
                      {uploadingId === row.id ? t('admin.homeBanners.uploading') : t('admin.homeBanners.upload')}
                    </button>
                    {row.imageUrl ? (
                      <button type="button" style={actionBtn} onClick={() => patchRow(activeLocale, row.id, 'imageUrl', '')}>
                        {t('admin.homeBanners.removeImage')}
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={(el) => {
                      if (el) fileInputs.current.set(row.id, el);
                      else fileInputs.current.delete(row.id);
                    }}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files && e.target.files[0];
                      handleImageUpload(row.id, file);
                      e.target.value = '';
                    }}
                  />
                  {row.imageUrl ? (
                    <img
                      src={row.imageUrl}
                      alt=""
                      style={{ width: '100%', maxWidth: '280px', borderRadius: '10px', border: '1px solid var(--admin-border)' }}
                    />
                  ) : (
                    <span style={{ fontSize: '0.82rem', opacity: 0.7 }}>{t('admin.homeBanners.imageHint')}</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>{t('admin.homeBanners.preview')}</span>
                <div className="home-banner-viewport" style={{ maxWidth: '100%' }}>
                  <BannerPreview banner={row} isAr={activeLocale === 'ar'} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminPanel>
  );
};

export default AdminHomeBanners;
