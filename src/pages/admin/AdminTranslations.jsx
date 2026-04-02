import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { applyTranslationOverrideEntries, getI18nDefaultSource, i18n } from '../../i18n.js';
import {
    TRANSLATION_OVERRIDES_DOC,
    unionLeafPaths,
    getByPath,
    computeOverrideDiff
} from '../../translationMerge.js';
import { adminAlign } from './adminUi.js';

function toTextareaValue(v) {
    if (v === null || v === undefined) return '';
    return String(v);
}

const textareaStyle = {
    width: '100%',
    minHeight: '72px',
    padding: '0.65rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid #30363d',
    background: '#0d1117',
    color: '#e6edf3',
    fontSize: '0.88rem',
    lineHeight: 1.45,
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
};

const keyCellStyle = {
    fontSize: '0.78rem',
    color: '#8b949e',
    wordBreak: 'break-word',
    fontFamily: 'ui-monospace, monospace'
};

export default function AdminTranslations({ lang }) {
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
    const [search, setSearch] = useState('');
    const [visibleCount, setVisibleCount] = useState(80);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ kind: '', text: '' });

    const buildRowsFromCurrentI18n = useCallback(() => {
        const def = getI18nDefaultSource();
        const keys = unionLeafPaths(def);
        const src = i18n;
        return keys.map((key) => ({
            key,
            en: toTextareaValue(getByPath(src.en, key)),
            ar: toTextareaValue(getByPath(src.ar, key))
        }));
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setMessage({ kind: '', text: '' });
            try {
                const ref = doc(db, TRANSLATION_OVERRIDES_DOC[0], TRANSLATION_OVERRIDES_DOC[1]);
                const snap = await getDoc(ref);
                if (!cancelled && snap.exists()) {
                    const entries = snap.data()?.entries;
                    if (entries && typeof entries === 'object') {
                        applyTranslationOverrideEntries(entries);
                    }
                }
                if (!cancelled) setRows(buildRowsFromCurrentI18n());
            } catch (e) {
                console.error(e);
                if (!cancelled) {
                    setMessage({ kind: 'error', text: t('admin.translationsPage.loadError') });
                    setRows(buildRowsFromCurrentI18n());
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [buildRowsFromCurrentI18n, lang, t]);

    useEffect(() => {
        setVisibleCount(80);
    }, [search]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(
            (r) =>
                r.key.toLowerCase().includes(q) ||
                r.ar.toLowerCase().includes(q) ||
                r.en.toLowerCase().includes(q)
        );
    }, [rows, search]);

    const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

    const updateCell = (key, field, value) => {
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    };

    const resetRow = (key) => {
        const defs = getI18nDefaultSource();
        setRows((prev) =>
            prev.map((r) =>
                r.key === key
                    ? {
                          key,
                          en: toTextareaValue(getByPath(defs.en, key)),
                          ar: toTextareaValue(getByPath(defs.ar, key))
                      }
                    : r
            )
        );
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage({ kind: '', text: '' });
        try {
            const entries = computeOverrideDiff(getI18nDefaultSource(), rows);
            await setDoc(
                doc(db, TRANSLATION_OVERRIDES_DOC[0], TRANSLATION_OVERRIDES_DOC[1]),
                { entries, updatedAt: serverTimestamp() },
                { merge: true }
            );
            applyTranslationOverrideEntries(entries);
            setMessage({ kind: 'success', text: t('admin.translationsPage.saved') });
        } catch (e) {
            console.error(e);
            setMessage({ kind: 'error', text: t('admin.translationsPage.saveError') });
        } finally {
            setSaving(false);
        }
    };

    const countLabel = t('admin.translationsPage.countShown')
        .replace('{n}', String(visible.length))
        .replace('{total}', String(filtered.length));

    if (loading) {
        return (
            <div style={{ color: '#8b949e', textAlign: adminAlign(isAr) }}>
                {t('admin.translationsPage.loading')}
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
            <p
                style={{
                    margin: 0,
                    color: '#8b949e',
                    fontSize: '0.95rem',
                    lineHeight: 1.55,
                    textAlign: adminAlign(isAr)
                }}
            >
                {t('admin.translationsPage.blurb')}
            </p>

            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    alignItems: 'center',
                    justifyContent: isAr ? 'flex-end' : 'flex-start'
                }}
            >
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('admin.translationsPage.searchPlaceholder')}
                    style={{
                        flex: '1 1 220px',
                        minWidth: '180px',
                        maxWidth: '420px',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid #30363d',
                        background: '#0d1117',
                        color: '#e6edf3'
                    }}
                />
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        padding: '0.65rem 1.25rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: saving ? '#30363d' : 'var(--button-primary-bg, #238636)',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                >
                    {saving ? t('admin.translationsPage.saving') : t('admin.translationsPage.save')}
                </button>
            </div>

            {message.text ? (
                <div
                    style={{
                        padding: '0.65rem 0.9rem',
                        borderRadius: '8px',
                        background: message.kind === 'error' ? 'rgba(235,57,66,0.12)' : 'rgba(35,134,54,0.15)',
                        color: message.kind === 'error' ? '#ff7b72' : '#3fb950',
                        textAlign: adminAlign(isAr)
                    }}
                >
                    {message.text}
                </div>
            ) : null}

            <div style={{ color: '#8b949e', fontSize: '0.85rem', textAlign: adminAlign(isAr) }}>{countLabel}</div>

            <div style={{ overflowX: 'auto' }}>
                <table
                    style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.9rem'
                    }}
                >
                    <thead>
                        <tr style={{ borderBottom: '1px solid #30363d' }}>
                            <th
                                style={{
                                    textAlign: adminAlign(isAr),
                                    padding: '0.5rem 0.75rem',
                                    color: '#c9d1d9',
                                    width: '22%'
                                }}
                            >
                                {t('admin.translationsPage.keyCol')}
                            </th>
                            <th
                                style={{
                                    textAlign: adminAlign(isAr),
                                    padding: '0.5rem 0.75rem',
                                    color: '#c9d1d9',
                                    width: '39%'
                                }}
                            >
                                {t('admin.translationsPage.enCol')}
                            </th>
                            <th
                                style={{
                                    textAlign: adminAlign(isAr),
                                    padding: '0.5rem 0.75rem',
                                    color: '#c9d1d9',
                                    width: '39%'
                                }}
                            >
                                {t('admin.translationsPage.arCol')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((r) => (
                            <tr key={r.key} style={{ borderBottom: '1px solid #21262d', verticalAlign: 'top' }}>
                                <td style={{ padding: '0.65rem 0.75rem' }}>
                                    <div style={keyCellStyle}>{r.key}</div>
                                    <button
                                        type="button"
                                        onClick={() => resetRow(r.key)}
                                        style={{
                                            marginTop: '6px',
                                            padding: '4px 8px',
                                            fontSize: '0.72rem',
                                            borderRadius: '6px',
                                            border: '1px solid #30363d',
                                            background: 'transparent',
                                            color: '#8b949e',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t('admin.translationsPage.resetRow')}
                                    </button>
                                </td>
                                <td style={{ padding: '0.65rem 0.75rem' }}>
                                    <textarea
                                        value={r.en}
                                        onChange={(e) => updateCell(r.key, 'en', e.target.value)}
                                        style={textareaStyle}
                                        dir="ltr"
                                    />
                                </td>
                                <td style={{ padding: '0.65rem 0.75rem' }}>
                                    <textarea
                                        value={r.ar}
                                        onChange={(e) => updateCell(r.key, 'ar', e.target.value)}
                                        style={textareaStyle}
                                        dir="rtl"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {visible.length < filtered.length ? (
                <div style={{ textAlign: adminAlign(isAr) }}>
                    <button
                        type="button"
                        onClick={() => setVisibleCount((c) => c + 80)}
                        style={{
                            padding: '0.55rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid #30363d',
                            background: '#21262d',
                            color: '#c9d1d9',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        {t('admin.translationsPage.showMore')}
                    </button>
                </div>
            ) : null}
        </div>
    );
}
