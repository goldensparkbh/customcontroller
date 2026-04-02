import React, { useCallback, useEffect, useState } from 'react';
import { db } from '../../firebase';
import LoadingState from '../../components/LoadingState.jsx';
import { adminAlign } from './adminUi.js';
import {
    WHATSAPP_TEMPLATE_TAGS,
    loadWhatsAppTemplates,
    saveWhatsAppTemplates
} from './whatsappTemplates';

const fieldStyle = {
    width: '100%',
    padding: '0.75rem 0.85rem',
    borderRadius: '8px',
    border: '1px solid #30363d',
    background: '#0d1117',
    color: '#e6edf3'
};

/**
 * WhatsApp order message templates (Firestore: admin_settings/whatsapp_templates).
 * Separate from the main settings form save button.
 */
const AdminWhatsAppTemplatesSettings = ({ lang = 'ar' }) => {
    const isAr = lang === 'ar';
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [messageTone, setMessageTone] = useState('success');

    const load = useCallback(async () => {
        setLoading(true);
        setMessage('');
        try {
            const list = await loadWhatsAppTemplates(db);
            setRows(list.map((t) => ({ ...t })));
        } catch (error) {
            console.error(error);
            setMessage(isAr ? 'تعذر تحميل قوالب واتساب.' : 'Failed to load WhatsApp templates.');
            setMessageTone('error');
        } finally {
            setLoading(false);
        }
    }, [isAr]);

    useEffect(() => {
        load();
    }, [load]);

    const patchRow = (id, field, value) => {
        setRows((r) => r.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
    };

    const addRow = () => {
        setRows((r) => [
            ...r,
            {
                id: `tpl_${Date.now()}`,
                label: isAr ? 'قالب جديد' : 'New template',
                body: 'Hello {{customerName}},\n\n'
            }
        ]);
    };

    const removeRow = (id) => {
        if (rows.length <= 1) {
            alert(isAr ? 'يجب الإبقاء على قالب واحد على الأقل.' : 'Keep at least one template.');
            return;
        }
        if (!window.confirm(isAr ? 'حذف هذا القالب؟' : 'Delete this template?')) return;
        setRows((r) => r.filter((row) => row.id !== id));
    };

    const handleSave = async () => {
        if (!rows.length) {
            alert(isAr ? 'أضف قالبًا واحدًا على الأقل.' : 'Add at least one template.');
            return;
        }
        if (rows.some((r) => !String(r.label || '').trim())) {
            alert(isAr ? 'كل قالب يحتاج عنوانًا.' : 'Each template needs a title.');
            return;
        }
        setSaving(true);
        setMessage('');
        try {
            const saved = await saveWhatsAppTemplates(db, rows);
            setRows(saved.map((t) => ({ ...t })));
            setMessage(isAr ? 'تم حفظ قوالب واتساب.' : 'WhatsApp templates saved.');
            setMessageTone('success');
        } catch (error) {
            console.error(error);
            setMessage(isAr ? 'فشل حفظ القوالب.' : 'Failed to save templates.');
            setMessageTone('error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <LoadingState
                message={isAr ? 'جاري تحميل قوالب واتساب…' : 'Loading WhatsApp templates…'}
                minHeight="24vh"
            />
        );
    }

    return (
        <section
            style={{
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '12px',
                padding: '1.5rem 1.75rem',
                display: 'grid',
                gap: '1.35rem',
                direction: isAr ? 'rtl' : 'ltr'
            }}
        >
            <div
                style={{
                    textAlign: adminAlign(isAr),
                    borderBottom: '1px solid #30363d',
                    paddingBottom: '1.1rem'
                }}
            >
                <div
                    style={{
                        fontSize: '0.72rem',
                        color: '#58a6ff',
                        fontWeight: 800,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase'
                    }}
                >
                    {isAr ? 'القسم 6' : 'Section 6'}
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#e6edf3', marginTop: '0.4rem' }}>
                    {isAr ? 'قوالب رسائل واتساب (الطلبات)' : 'WhatsApp message templates (orders)'}
                </div>
                <div style={{ marginTop: '0.45rem', color: '#8b949e', fontSize: '0.95rem', lineHeight: 1.55 }}>
                    {isAr
                        ? 'تُستخدم هذه القوالب عند إرسال رسالة واتساب من تفاصيل الطلب. يمكنك إضافة وتعديل وحذف القوالب هنا.'
                        : 'Used when sending a WhatsApp message from an order. Add, edit, or delete templates here.'}
                </div>
            </div>

            <details
                style={{
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    borderRadius: '10px',
                    padding: '0.85rem 1rem',
                    textAlign: adminAlign(isAr)
                }}
            >
                <summary
                    style={{
                        cursor: 'pointer',
                        fontWeight: 600,
                        color: '#c9d1d9'
                    }}
                >
                    {isAr ? 'الوسوم المتاحة في نص القالب' : 'Available placeholders in template text'}
                </summary>
                <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.5rem', fontSize: '0.88rem' }}>
                    {WHATSAPP_TEMPLATE_TAGS.map((row) => (
                        <div key={row.tag} style={{ color: '#c9d1d9', lineHeight: 1.5 }}>
                            <code style={{ color: '#79c0ff', fontSize: '0.85rem' }}>{row.tag}</code>
                            <span style={{ color: '#8b949e', marginInlineStart: '0.5rem' }}>
                                {isAr ? row.ar : row.en}
                            </span>
                        </div>
                    ))}
                </div>
            </details>

            <div style={{ display: 'grid', gap: '1.25rem' }}>
                {rows.map((row) => (
                    <div
                        key={row.id}
                        style={{
                            border: '1px solid #30363d',
                            borderRadius: '10px',
                            padding: '1.1rem 1.2rem',
                            background: '#111827',
                            display: 'grid',
                            gap: '0.75rem',
                            textAlign: adminAlign(isAr)
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '0.75rem',
                                flexWrap: 'wrap',
                                alignItems: 'flex-start'
                            }}
                        >
                            <label style={{ display: 'grid', gap: '0.4rem', flex: '1 1 240px' }}>
                                <span style={{ color: '#8b949e', fontSize: '0.88rem' }}>
                                    {isAr ? 'عنوان القالب' : 'Template title'}
                                </span>
                                <input
                                    value={row.label}
                                    onChange={(e) => patchRow(row.id, 'label', e.target.value)}
                                    style={fieldStyle}
                                />
                            </label>
                            <button
                                type="button"
                                onClick={() => removeRow(row.id)}
                                disabled={saving}
                                style={{
                                    padding: '0.65rem 1rem',
                                    borderRadius: '8px',
                                    border: '1px solid #f85149',
                                    background: 'transparent',
                                    color: '#f85149',
                                    fontWeight: 600,
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    alignSelf: 'end'
                                }}
                            >
                                {isAr ? 'حذف' : 'Delete'}
                            </button>
                        </div>
                        <label style={{ display: 'grid', gap: '0.4rem' }}>
                            <span style={{ color: '#8b949e', fontSize: '0.88rem' }}>
                                {isAr ? 'نص الرسالة' : 'Message body'}
                            </span>
                            <textarea
                                value={row.body}
                                onChange={(e) => patchRow(row.id, 'body', e.target.value)}
                                rows={8}
                                style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55 }}
                            />
                        </label>
                        <div style={{ fontSize: '0.78rem', color: '#6e7681' }}>
                            {isAr ? 'المعرّف الداخلي:' : 'Internal ID:'}{' '}
                            <code style={{ color: '#8b949e' }}>{row.id}</code>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
                <button
                    type="button"
                    onClick={addRow}
                    disabled={saving}
                    style={{
                        padding: '0.65rem 1.1rem',
                        borderRadius: '8px',
                        border: '1px solid #3fb950',
                        background: 'rgba(63,185,80,0.12)',
                        color: '#3fb950',
                        fontWeight: 700,
                        cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isAr ? '+ إضافة قالب' : '+ Add template'}
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        padding: '0.65rem 1.25rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#238636',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.75 : 1
                    }}
                >
                    {saving ? (isAr ? 'جاري الحفظ…' : 'Saving…') : (isAr ? 'حفظ قوالب واتساب' : 'Save WhatsApp templates')}
                </button>
                <button
                    type="button"
                    onClick={load}
                    disabled={saving}
                    style={{
                        padding: '0.65rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid #3b4452',
                        background: '#21262d',
                        color: '#e6edf3',
                        fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isAr ? 'إعادة التحميل' : 'Reload'}
                </button>
                {message && (
                    <span style={{ color: messageTone === 'error' ? '#f87171' : '#4ade80', fontSize: '0.92rem' }}>
                        {message}
                    </span>
                )}
            </div>
        </section>
    );
};

export default AdminWhatsAppTemplatesSettings;
