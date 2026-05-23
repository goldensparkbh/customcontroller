import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminPatchDoc } from '../../services/backendApi.js';
import { adminAlign } from './adminUi.js';
import { padNumericString } from './recordNumbers';
import {
    appendStockMovement,
    buildInventoryPayload,
    formatInventoryDate,
    getInventoryReasonLabel,
    getOnHandFromRows,
    hydrateInventoryFormEntries,
    STOCK_QUICK_ACTIONS
} from './inventoryPricing';

const fieldStyle = {
    width: '100%',
    padding: '0.55rem 0.65rem',
    borderRadius: '8px',
    border: '1px solid var(--admin-border)',
    background: 'var(--admin-raised)',
    color: 'var(--admin-input-text)',
    fontSize: '0.9rem'
};

function stockStatusMeta(qty, isAr) {
    const n = Number(qty) || 0;
    if (n <= 0) {
        return {
            label: isAr ? 'نفد' : 'Out of stock',
            bg: 'rgba(248, 113, 113, 0.14)',
            border: 'rgba(248, 113, 113, 0.35)',
            color: '#fca5a5'
        };
    }
    if (n <= 5) {
        return {
            label: isAr ? 'منخفض' : 'Low',
            bg: 'rgba(245, 158, 11, 0.14)',
            border: 'rgba(245, 158, 11, 0.35)',
            color: '#fdba74'
        };
    }
    return {
        label: isAr ? 'متوفر' : 'In stock',
        bg: 'rgba(34, 197, 94, 0.14)',
        border: 'rgba(34, 197, 94, 0.35)',
        color: '#86efac'
    };
}

const PartOptionsStockManager = ({
    partId,
    partTitle,
    options = [],
    lang = 'ar',
    searchQuery = '',
    stockFilter = 'all',
    focusOptionId = '',
    onSaved
}) => {
    const isAr = lang === 'ar';
    const align = adminAlign(isAr);

    const [selectedId, setSelectedId] = useState('');
    const [rowsByOption, setRowsByOption] = useState({});
    const [savingId, setSavingId] = useState('');
    const [activeAction, setActiveAction] = useState(null);
    const [actionQty, setActionQty] = useState('1');
    const [actionNote, setActionNote] = useState('');
    const [showHistory, setShowHistory] = useState(true);

    const filteredOptions = useMemo(() => {
        const q = String(searchQuery || '').trim().toLowerCase();
        return options.filter((opt) => {
            const qty = Number(opt.quantity) || 0;
            if (stockFilter === 'in' && qty <= 0) return false;
            if (stockFilter === 'out' && qty > 0) return false;
            if (stockFilter === 'low' && (qty <= 0 || qty > 5)) return false;
            if (!q) return true;
            const hay = [opt.name, opt.barcode, opt.itemNumber, opt.id]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }, [options, searchQuery, stockFilter]);

    useEffect(() => {
        const next = {};
        options.forEach((opt) => {
            next[opt.id] = hydrateInventoryFormEntries(opt);
        });
        setRowsByOption(next);
    }, [options]);

    useEffect(() => {
        if (focusOptionId && filteredOptions.some((o) => o.id === focusOptionId)) {
            setSelectedId(focusOptionId);
            return;
        }
        if (!filteredOptions.length) {
            setSelectedId('');
            return;
        }
        if (!filteredOptions.some((o) => o.id === selectedId)) {
            setSelectedId(filteredOptions[0].id);
        }
    }, [filteredOptions, selectedId, focusOptionId]);

    const selectedOption = useMemo(
        () => filteredOptions.find((o) => o.id === selectedId) || filteredOptions[0] || null,
        [filteredOptions, selectedId]
    );

    const selectedRows = selectedOption ? rowsByOption[selectedOption.id] || [] : [];
    const onHand = selectedOption
        ? getOnHandFromRows(selectedRows, { quantity: selectedOption.quantity })
        : 0;

    const persistOption = useCallback(
        async (option, rows) => {
            const inventoryPayload = buildInventoryPayload(
                rows,
                {
                    purchasePrice: option.purchasePrice,
                    sellPrice: option.sellPrice ?? option.price
                },
                { quantity: option.quantity ?? 0 }
            );

            await adminPatchDoc(`configurator_parts/${partId}/options/${option.id}`, {
                inventoryDetails: inventoryPayload.inventoryDetails,
                quantity: inventoryPayload.quantity,
                updatedAt: new Date().toISOString()
            });

            setRowsByOption((prev) => ({ ...prev, [option.id]: hydrateInventoryFormEntries({
                ...option,
                inventoryDetails: inventoryPayload.inventoryDetails,
                quantity: inventoryPayload.quantity
            }) }));

            if (typeof onSaved === 'function') onSaved();
        },
        [partId, onSaved]
    );

    const applyQuickAction = async (actionKey) => {
        if (!selectedOption || savingId) return;
        const qty = String(actionQty || '').trim();
        if (!qty || Number(qty) === 0) {
            alert(isAr ? 'أدخل كمية صالحة.' : 'Enter a valid quantity.');
            return;
        }
        if (actionKey === 'adjust' && Number(qty) === 0) {
            alert(isAr ? 'التعديل يتطلب قيمة غير صفر.' : 'Adjustment requires a non-zero value.');
            return;
        }

        const nextRows = appendStockMovement(selectedRows, {
            actionKey,
            quantity: qty,
            note: actionNote
        });

        setSavingId(selectedOption.id);
        try {
            await persistOption(selectedOption, nextRows);
            setActiveAction(null);
            setActionNote('');
            setActionQty('1');
        } catch (err) {
            console.error(err);
            alert(isAr ? 'فشل حفظ حركة المخزون.' : 'Failed to save stock movement.');
        } finally {
            setSavingId('');
        }
    };

    const applyStep = async (delta) => {
        if (!selectedOption || savingId) return;
        const actionKey = delta > 0 ? 'receive' : 'issue';
        const nextRows = appendStockMovement(selectedRows, {
            actionKey,
            quantity: Math.abs(delta),
            note: delta > 0 ? (isAr ? 'زيادة سريعة' : 'Quick increase') : (isAr ? 'خصم سريع' : 'Quick decrease')
        });
        setSavingId(selectedOption.id);
        try {
            await persistOption(selectedOption, nextRows);
        } catch (err) {
            console.error(err);
            alert(isAr ? 'فشل التحديث.' : 'Update failed.');
        } finally {
            setSavingId('');
        }
    };

    const sortedHistory = useMemo(
        () => [...selectedRows].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
        [selectedRows]
    );

    const summary = useMemo(() => {
        let inStock = 0;
        let out = 0;
        let low = 0;
        let units = 0;
        options.forEach((o) => {
            const q = Number(o.quantity) || 0;
            units += q;
            if (q <= 0) out += 1;
            else {
                inStock += 1;
                if (q <= 5) low += 1;
            }
        });
        return { total: options.length, inStock, out, low, units };
    }, [options]);

    const actionBtn = (key, accent) => {
        const action = STOCK_QUICK_ACTIONS[key];
        const active = activeAction === key;
        return (
            <button
                key={key}
                type="button"
                disabled={!selectedOption || Boolean(savingId)}
                onClick={() => {
                    setActiveAction(active ? null : key);
                    setActionQty(key === 'adjust' ? '' : '1');
                }}
                style={{
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: `1px solid ${active ? accent : 'var(--admin-border)'}`,
                    background: active ? `${accent}22` : 'var(--admin-hover-alt)',
                    color: active ? accent : 'var(--admin-text)',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: selectedOption && !savingId ? 'pointer' : 'not-allowed',
                    opacity: selectedOption && !savingId ? 1 : 0.55
                }}
            >
                {isAr ? action.labelAr : action.labelEn}
            </button>
        );
    };

    return (
        <div style={{ display: 'grid', gap: '1rem', direction: isAr ? 'rtl' : 'ltr' }}>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '0.65rem'
                }}
            >
                {[
                    { label: isAr ? 'الخيارات' : 'Options', value: summary.total },
                    { label: isAr ? 'متوفر' : 'In stock', value: summary.inStock },
                    { label: isAr ? 'منخفض' : 'Low', value: summary.low },
                    { label: isAr ? 'نفد' : 'Out', value: summary.out },
                    { label: isAr ? 'إجمالي الوحدات' : 'Total units', value: summary.units }
                ].map((card) => (
                    <div
                        key={card.label}
                        style={{
                            background: 'var(--admin-raised)',
                            border: '1px solid var(--admin-border)',
                            borderRadius: '10px',
                            padding: '0.75rem 0.9rem',
                            textAlign: align
                        }}
                    >
                        <div style={{ fontSize: '0.72rem', color: 'var(--admin-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {card.label}
                        </div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--admin-text-strong)', marginTop: '0.2rem' }}>
                            {card.value}
                        </div>
                    </div>
                ))}
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1rem',
                    minHeight: '420px',
                    alignItems: 'stretch'
                }}
            >
                {/* Option list */}
                <div
                    style={{
                        background: 'var(--admin-raised)',
                        border: '1px solid var(--admin-border)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0
                    }}
                >
                    <div
                        style={{
                            padding: '0.75rem 1rem',
                            borderBottom: '1px solid var(--admin-border)',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            color: 'var(--admin-text)',
                            textAlign: align
                        }}
                    >
                        {isAr ? 'خيارات الجزء' : 'Part options'}
                        <span style={{ color: 'var(--admin-muted)', fontWeight: 500 }}> · {filteredOptions.length}</span>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {filteredOptions.length === 0 ? (
                            <div style={{ padding: '1.25rem', color: 'var(--admin-muted)', textAlign: 'center', fontSize: '0.88rem' }}>
                                {isAr ? 'لا توجد خيارات مطابقة.' : 'No matching options.'}
                            </div>
                        ) : (
                            filteredOptions.map((opt) => {
                                const qty = Number(opt.quantity) || 0;
                                const status = stockStatusMeta(qty, isAr);
                                const selected = opt.id === selectedId;
                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setSelectedId(opt.id)}
                                        style={{
                                            display: 'block',
                                            width: '100%',
                                            textAlign: align,
                                            padding: '0.85rem 1rem',
                                            border: 'none',
                                            borderBottom: '1px solid var(--admin-border)',
                                            background: selected ? 'rgba(88, 166, 255, 0.12)' : 'transparent',
                                            cursor: 'pointer',
                                            color: 'inherit'
                                        }}
                                    >
                                        <div style={{ fontWeight: 600, color: 'var(--admin-text-strong)', fontSize: '0.92rem' }}>
                                            {opt.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-muted)', marginTop: '0.2rem' }}>
                                            #{padNumericString(opt.itemNumber)}
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginTop: '0.45rem',
                                                gap: '0.5rem',
                                                flexDirection: isAr ? 'row-reverse' : 'row'
                                            }}
                                        >
                                            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--admin-text)' }}>{qty}</span>
                                            <span
                                                style={{
                                                    fontSize: '0.68rem',
                                                    fontWeight: 700,
                                                    padding: '2px 8px',
                                                    borderRadius: '999px',
                                                    background: status.bg,
                                                    border: `1px solid ${status.border}`,
                                                    color: status.color
                                                }}
                                            >
                                                {status.label}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Workspace */}
                <div
                    style={{
                        background: 'var(--admin-surface)',
                        border: '1px solid var(--admin-border)',
                        borderRadius: '10px',
                        padding: '1.1rem 1.25rem',
                        display: 'grid',
                        gap: '1rem',
                        alignContent: 'start',
                        minHeight: 0,
                        overflowY: 'auto'
                    }}
                >
                    {!selectedOption ? (
                        <div style={{ color: 'var(--admin-muted)', textAlign: 'center', padding: '2rem' }}>
                            {isAr ? 'اختر خياراً لإدارة المخزون.' : 'Select an option to manage stock.'}
                        </div>
                    ) : (
                        <>
                            <div style={{ textAlign: align }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--admin-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    {partTitle}
                                </div>
                                <h3 style={{ margin: '0.25rem 0 0', color: 'var(--admin-text-strong)', fontSize: '1.25rem' }}>
                                    {selectedOption.name}
                                </h3>
                                <div style={{ marginTop: '0.35rem', fontSize: '0.82rem', color: 'var(--admin-muted)' }}>
                                    #{padNumericString(selectedOption.itemNumber)} · {selectedOption.barcode || '—'}
                                </div>
                            </div>

                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '1rem',
                                    flexWrap: 'wrap',
                                    padding: '1rem 1.1rem',
                                    borderRadius: '10px',
                                    background: 'var(--admin-raised)',
                                    border: '1px solid var(--admin-border)',
                                    flexDirection: isAr ? 'row-reverse' : 'row'
                                }}
                            >
                                <div style={{ textAlign: align }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--admin-muted)', textTransform: 'uppercase' }}>
                                        {isAr ? 'المخزون الحالي' : 'On hand'}
                                    </div>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--admin-text-strong)', lineHeight: 1.1 }}>
                                        {savingId === selectedOption.id ? '…' : onHand}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexDirection: isAr ? 'row-reverse' : 'row' }}>
                                    <button
                                        type="button"
                                        disabled={Boolean(savingId)}
                                        onClick={() => applyStep(-1)}
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: '8px',
                                            border: '1px solid var(--admin-border-strong)',
                                            background: 'var(--admin-hover)',
                                            color: 'var(--admin-text)',
                                            fontSize: '1.25rem',
                                            cursor: savingId ? 'wait' : 'pointer'
                                        }}
                                    >
                                        −
                                    </button>
                                    <button
                                        type="button"
                                        disabled={Boolean(savingId)}
                                        onClick={() => applyStep(1)}
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: '#238636',
                                            color: 'var(--admin-on-primary)',
                                            fontSize: '1.25rem',
                                            cursor: savingId ? 'wait' : 'pointer'
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <div style={{ textAlign: align }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--admin-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                                    {isAr ? 'حركات سريعة' : 'Quick movements'}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', flexDirection: isAr ? 'row-reverse' : 'row' }}>
                                    {actionBtn('receive', '#22c55e')}
                                    {actionBtn('issue', '#f97316')}
                                    {actionBtn('return', '#3b82f6')}
                                    {actionBtn('adjust', '#a855f7')}
                                </div>
                            </div>

                            {activeAction && STOCK_QUICK_ACTIONS[activeAction] && (
                                <div
                                    style={{
                                        padding: '1rem',
                                        borderRadius: '10px',
                                        border: '1px solid var(--admin-border)',
                                        background: 'var(--admin-raised)',
                                        display: 'grid',
                                        gap: '0.75rem'
                                    }}
                                >
                                    <div style={{ textAlign: align }}>
                                        <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>
                                            {isAr
                                                ? STOCK_QUICK_ACTIONS[activeAction].labelAr
                                                : STOCK_QUICK_ACTIONS[activeAction].labelEn}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--admin-muted)', marginTop: '0.2rem' }}>
                                            {isAr
                                                ? STOCK_QUICK_ACTIONS[activeAction].hintAr
                                                : STOCK_QUICK_ACTIONS[activeAction].hintEn}
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.65rem' }}>
                                        <label style={{ display: 'grid', gap: '0.35rem', textAlign: align }}>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--admin-muted)' }}>
                                                {activeAction === 'adjust'
                                                    ? (isAr ? 'التصحيح (+/−)' : 'Correction (+/−)')
                                                    : (isAr ? 'الكمية' : 'Quantity')}
                                            </span>
                                            <input
                                                type="number"
                                                step={activeAction === 'adjust' ? '1' : '1'}
                                                min={activeAction === 'adjust' ? undefined : '1'}
                                                value={actionQty}
                                                onChange={(e) => setActionQty(e.target.value)}
                                                style={fieldStyle}
                                                placeholder={activeAction === 'adjust' ? (isAr ? 'مثال: -2 أو 5' : 'e.g. -2 or 5') : '1'}
                                            />
                                        </label>
                                        <label style={{ display: 'grid', gap: '0.35rem', textAlign: align, gridColumn: '1 / -1' }}>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--admin-muted)' }}>
                                                {isAr ? 'ملاحظة (اختياري)' : 'Note (optional)'}
                                            </span>
                                            <input
                                                type="text"
                                                value={actionNote}
                                                onChange={(e) => setActionNote(e.target.value)}
                                                style={fieldStyle}
                                                placeholder={isAr ? 'سبب أو مرجع' : 'Reason or reference'}
                                            />
                                        </label>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap', flexDirection: isAr ? 'row-reverse' : 'row' }}>
                                        <button
                                            type="button"
                                            onClick={() => setActiveAction(null)}
                                            style={{
                                                padding: '0.55rem 0.9rem',
                                                borderRadius: '8px',
                                                border: '1px solid var(--admin-border)',
                                                background: 'transparent',
                                                color: 'var(--admin-text-secondary)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {isAr ? 'إلغاء' : 'Cancel'}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={Boolean(savingId)}
                                            onClick={() => applyQuickAction(activeAction)}
                                            style={{
                                                padding: '0.55rem 1rem',
                                                borderRadius: '8px',
                                                border: 'none',
                                                background: '#238636',
                                                color: 'var(--admin-on-primary)',
                                                fontWeight: 700,
                                                cursor: savingId ? 'wait' : 'pointer'
                                            }}
                                        >
                                            {savingId
                                                ? (isAr ? 'جاري الحفظ...' : 'Saving...')
                                                : (isAr ? 'تطبيق و حفظ' : 'Apply & save')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div>
                                <button
                                    type="button"
                                    onClick={() => setShowHistory((v) => !v)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.65rem 0',
                                        border: 'none',
                                        borderTop: '1px solid var(--admin-border)',
                                        background: 'transparent',
                                        color: 'var(--admin-text)',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        flexDirection: isAr ? 'row-reverse' : 'row'
                                    }}
                                >
                                    <span>{isAr ? 'سجل الحركات' : 'Movement history'}</span>
                                    <span style={{ color: 'var(--admin-muted)', fontSize: '0.85rem' }}>
                                        {sortedHistory.length} {showHistory ? '▾' : '▸'}
                                    </span>
                                </button>
                                {showHistory && (
                                    <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
                                        {sortedHistory.length === 0 ? (
                                            <div style={{ color: 'var(--admin-muted)', fontSize: '0.85rem', textAlign: align, padding: '0.5rem 0' }}>
                                                {isAr ? 'لا توجد حركات بعد.' : 'No movements yet.'}
                                            </div>
                                        ) : (
                                            sortedHistory.map((row) => {
                                                const q = Number(row.quantity) || 0;
                                                const outgoing = q < 0;
                                                return (
                                                    <div
                                                        key={row.id}
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            gap: '0.75rem',
                                                            padding: '0.55rem 0.65rem',
                                                            borderRadius: '8px',
                                                            border: `1px solid ${outgoing ? 'rgba(248,113,113,0.3)' : 'var(--admin-border)'}`,
                                                            background: outgoing ? 'rgba(127,29,29,0.12)' : 'var(--admin-hover-alt)',
                                                            flexDirection: isAr ? 'row-reverse' : 'row',
                                                            alignItems: 'flex-start'
                                                        }}
                                                    >
                                                        <div style={{ textAlign: align, minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--admin-text)' }}>
                                                                {getInventoryReasonLabel(row.reason, lang)}
                                                            </div>
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--admin-muted)' }}>
                                                                {formatInventoryDate(row.date)}
                                                                {row.note ? ` · ${row.note}` : ''}
                                                            </div>
                                                        </div>
                                                        <span
                                                            style={{
                                                                fontWeight: 800,
                                                                color: outgoing ? '#fca5a5' : '#86efac',
                                                                flexShrink: 0
                                                            }}
                                                        >
                                                            {q > 0 ? '+' : ''}{q}
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PartOptionsStockManager;
