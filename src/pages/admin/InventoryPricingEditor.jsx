import React, { useState } from 'react';
import {
    createInventoryEntry,
    formatInventoryDate,
    getInventoryReasonLabel,
    INVENTORY_REASON_OPTIONS
} from './inventoryPricing';
import { adminAlign } from './adminUi.js';

const sectionStyle = {
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '8px',
    padding: '1rem',
    display: 'grid',
    gap: '1rem'
};

const fieldStyle = {
    width: '100%',
    padding: '0.7rem 0.8rem',
    borderRadius: '8px',
    border: '1px solid #30363d',
    background: '#0d1117',
    color: '#e6edf3'
};

const overlayStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(3, 7, 18, 0.78)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    zIndex: 1400
};

const modalStyle = {
    width: 'min(520px, 100%)',
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '12px',
    boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
    overflow: 'hidden'
};

const InventoryPricingEditor = ({
    rows,
    onChange,
    title = 'Inventory',
    description = 'Inventory is managed as stock movements. Use Add Inventory to increase stock and keep a dated history.',
    lang = 'ar'
}) => {
    const isAr = lang === 'ar';
    const safeRows = Array.isArray(rows) ? rows : [];
    const [showAddModal, setShowAddModal] = useState(false);
    const [draftRow, setDraftRow] = useState({
        quantity: '',
        date: new Date().toISOString().slice(0, 10),
        reason: 'new_stock'
    });

    const resetDraft = () => {
        setDraftRow({
            quantity: '',
            date: new Date().toISOString().slice(0, 10),
            reason: 'new_stock'
        });
    };

    const closeAddModal = () => {
        setShowAddModal(false);
        resetDraft();
    };

    const handleRemoveRow = (rowId) => {
        if (!window.confirm(isAr ? "هل أنت متأكد من حذف هذا السجل؟" : "Are you sure you want to remove this record?")) return;
        onChange(safeRows.filter((row) => row.id !== rowId));
    };

    const canAddRow = Number(draftRow.quantity) > 0 && Boolean(draftRow.date);

    const handleAddRow = (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (!canAddRow) return;
        onChange([
            ...safeRows,
            createInventoryEntry({
                quantity: draftRow.quantity,
                date: draftRow.date,
                reason: draftRow.reason,
                source: 'manual'
            })
        ]);
        closeAddModal();
    };

    const sortedRows = [...safeRows].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    return (
        <div style={{ ...sectionStyle, direction: isAr ? 'rtl' : 'ltr' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', flexDirection: isAr ? 'row-reverse' : 'row' }}>
                <div style={{ textAlign: adminAlign(isAr) }}>
                    <div style={{ fontWeight: 700, color: '#e6edf3' }}>{title}</div>
                    <div style={{ marginTop: '0.2rem', fontSize: '0.82rem', color: '#8b949e' }}>{description}</div>
                </div>

                <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    style={{
                        padding: '0.6rem 0.9rem',
                        borderRadius: '8px',
                        border: '1px solid #3b4452',
                        background: '#111827',
                        color: '#e6edf3',
                        cursor: 'pointer'
                    }}
                >
                    {isAr ? "إضافة مخزون" : "Add Inventory"}
                </button>
            </div>

            <div style={{ display: 'grid', gap: '0.85rem' }}>
                {sortedRows.length > 0 ? sortedRows.map((row, index) => {
                    const quantity = Number(row.quantity || 0);
                    const isOutgoing = quantity < 0;
                    return (
                        <div
                            key={row.id || `inventory-entry-${index}`}
                            style={{
                                display: 'grid',
                                gap: '0.8rem',
                                padding: '0.9rem',
                                borderRadius: '8px',
                                border: isOutgoing ? '1px solid rgba(248, 113, 113, 0.35)' : '1px solid #30363d',
                                background: isOutgoing ? 'rgba(127, 29, 29, 0.18)' : '#111827'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', flexDirection: isAr ? 'row-reverse' : 'row' }}>
                                <div style={{ display: 'grid', gap: '0.2rem', textAlign: adminAlign(isAr) }}>
                                    <div style={{ fontSize: '0.85rem', color: '#e6edf3', fontWeight: 600 }}>
                                        {getInventoryReasonLabel(row.reason, lang)}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: '#8b949e' }}>
                                        {formatInventoryDate(row.date)}{row.source === 'system' ? (isAr ? ' · نظام' : ' · System') : ''}
                                    </div>
                                    {row.note && (
                                        <div style={{ fontSize: '0.78rem', color: '#8b949e', fontStyle: 'italic', marginTop: '0.15rem' }}>
                                            {row.note}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flexDirection: isAr ? 'row-reverse' : 'row' }}>
                                    <span style={{ color: isOutgoing ? '#fca5a5' : '#86efac', fontWeight: 700 }}>
                                        {quantity > 0 ? '+' : ''}{quantity}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveRow(row.id)}
                                        style={{
                                            padding: '0.45rem 0.7rem',
                                            borderRadius: '6px',
                                            border: '1px solid #f85149',
                                            background: 'transparent',
                                            color: '#ff7b72',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {isAr ? "إزالة" : "Remove"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div style={{ padding: '0.95rem', borderRadius: '8px', border: '1px dashed #30363d', color: '#8b949e', background: '#111827', textAlign: adminAlign(isAr) }}>
                        {isAr ? "لا توجد حركات مخزون مسجلة بعد." : "No inventory movements recorded yet."}
                    </div>
                )}
            </div>

            {showAddModal && (
                <div onClick={closeAddModal} style={overlayStyle}>
                    <div
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        onKeyDownCapture={(event) => {
                            if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
                                event.preventDefault();
                            }
                        }}
                        style={modalStyle}
                    >
                        <div style={{ display: 'grid', gap: '1rem', padding: '1.25rem 1.5rem', direction: isAr ? 'rtl' : 'ltr' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', flexDirection: isAr ? 'row-reverse' : 'row' }}>
                                <div style={{ textAlign: adminAlign(isAr) }}>
                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e6edf3' }}>{isAr ? "إضافة مخزون" : "Add Inventory"}</div>
                                    <div style={{ marginTop: '0.25rem', fontSize: '0.82rem', color: '#8b949e' }}>
                                        {isAr ? "إضافة حركة مخزون مؤرخة. تتم إضافة الكمية إلى المخزون الحالي." : "Add a dated stock movement. Quantity is added to current stock."}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={closeAddModal}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '6px',
                                        border: '1px solid #3b4452',
                                        background: '#0d1117',
                                        color: '#e6edf3',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {isAr ? "إغلاق" : "Close"}
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                                <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
                                    <span>{isAr ? "كمية المخزون" : "Inventory Qty"}</span>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={draftRow.quantity}
                                        onChange={(event) => setDraftRow((current) => ({ ...current, quantity: event.target.value }))}
                                        style={fieldStyle}
                                    />
                                </label>

                                <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
                                    <span>{isAr ? "التاريخ" : "Date"}</span>
                                    <input
                                        type="date"
                                        required
                                        value={draftRow.date}
                                        onChange={(event) => setDraftRow((current) => ({ ...current, date: event.target.value }))}
                                        style={fieldStyle}
                                    />
                                </label>

                                <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
                                    <span>{isAr ? "السبب" : "Reason"}</span>
                                    <select
                                        value={draftRow.reason}
                                        onChange={(event) => setDraftRow((current) => ({ ...current, reason: event.target.value }))}
                                        style={fieldStyle}
                                    >
                                        {INVENTORY_REASON_OPTIONS
                                            .filter((option) => option.value !== 'order_allocation' && option.value !== 'opening_balance')
                                            .map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {isAr ? (option.labelAr || option.label) : option.label}
                                                </option>
                                            ))}
                                    </select>
                                </label>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', flexDirection: isAr ? 'row-reverse' : 'row' }}>
                                <button
                                    type="button"
                                    onClick={closeAddModal}
                                    style={{
                                        padding: '0.65rem 0.9rem',
                                        borderRadius: '8px',
                                        border: '1px solid #3b4452',
                                        background: '#0d1117',
                                        color: '#e6edf3',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {isAr ? "إلغاء" : "Cancel"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddRow}
                                    disabled={!canAddRow}
                                    style={{
                                        padding: '0.65rem 0.9rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: '#238636',
                                        color: '#fff',
                                        fontWeight: 700,
                                        cursor: canAddRow ? 'pointer' : 'not-allowed',
                                        opacity: canAddRow ? 1 : 0.6
                                    }}
                                >
                                    {isAr ? "إضافة مخزون" : "Add Inventory"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryPricingEditor;
