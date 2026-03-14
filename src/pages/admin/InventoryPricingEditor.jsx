import React, { useMemo, useState } from 'react';
import { createInventoryEntry } from './inventoryPricing';

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

const normalizeRowsAfterRemove = (rows) => {
    if (!rows.length) {
        return [createInventoryEntry({ purchasePrice: 0, sellPrice: 0, quantity: 0, isActive: true })];
    }

    if (rows.some((row) => row.isActive)) return rows;

    return rows.map((row, index) => ({
        ...row,
        isActive: index === 0
    }));
};

const InventoryPricingEditor = ({
    rows,
    onChange,
    title = 'Inventory & Pricing',
    description = 'Only the active row is used on the platform for sell price and available quantity.'
}) => {
    const safeRows = Array.isArray(rows) && rows.length > 0
        ? rows
        : [createInventoryEntry({ purchasePrice: 0, sellPrice: 0, quantity: 0, isActive: true })];
    const radioGroupName = useMemo(() => `activeInventoryRow_${Math.random().toString(36).slice(2, 8)}`, []);
    const [showAddModal, setShowAddModal] = useState(false);
    const [draftRow, setDraftRow] = useState({
        purchasePrice: '',
        sellPrice: '',
        quantity: ''
    });

    const resetDraft = () => {
        setDraftRow({
            purchasePrice: '',
            sellPrice: '',
            quantity: ''
        });
    };

    const handleActiveChange = (rowId) => {
        onChange(safeRows.map((row) => ({
            ...row,
            isActive: row.id === rowId
        })));
    };

    const handleRemoveRow = (rowId) => {
        onChange(normalizeRowsAfterRemove(safeRows.filter((row) => row.id !== rowId)));
    };

    const openAddModal = () => {
        resetDraft();
        setShowAddModal(true);
    };

    const closeAddModal = () => {
        setShowAddModal(false);
        resetDraft();
    };

    const handleAddRow = (event) => {
        event.preventDefault();
        onChange([
            ...safeRows,
            createInventoryEntry({
                purchasePrice: draftRow.purchasePrice,
                sellPrice: draftRow.sellPrice,
                quantity: draftRow.quantity,
                isActive: false
            })
        ]);
        closeAddModal();
    };

    return (
        <div style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontWeight: 700, color: '#e6edf3' }}>{title}</div>
                    <div style={{ marginTop: '0.2rem', fontSize: '0.82rem', color: '#8b949e' }}>{description}</div>
                </div>

                <button
                    type="button"
                    onClick={openAddModal}
                    style={{
                        padding: '0.6rem 0.9rem',
                        borderRadius: '8px',
                        border: '1px solid #3b4452',
                        background: '#111827',
                        color: '#e6edf3',
                        cursor: 'pointer'
                    }}
                >
                    Add Inventory Row
                </button>
            </div>

            <div style={{ display: 'grid', gap: '0.85rem' }}>
                {safeRows.map((row, index) => (
                    <div
                        key={row.id}
                        style={{
                            display: 'grid',
                            gap: '0.9rem',
                            padding: '0.9rem',
                            borderRadius: '8px',
                            border: row.isActive ? '1px solid #1f6feb' : '1px solid #30363d',
                            background: row.isActive ? 'rgba(31, 111, 235, 0.08)' : '#111827'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ fontSize: '0.85rem', color: '#e6edf3', fontWeight: 600 }}>
                                Inventory Row {index + 1}
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#e6edf3', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name={radioGroupName}
                                        checked={row.isActive}
                                        onChange={() => handleActiveChange(row.id)}
                                    />
                                    Use on platform
                                </label>

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
                                    Remove
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                            <div style={{ display: 'grid', gap: '0.25rem' }}>
                                <span style={{ fontSize: '0.78rem', color: '#8b949e' }}>Purchase Price</span>
                                <strong style={{ color: '#e6edf3' }}>{Number(row.purchasePrice || 0).toFixed(2)} BHD</strong>
                            </div>

                            <div style={{ display: 'grid', gap: '0.25rem' }}>
                                <span style={{ fontSize: '0.78rem', color: '#8b949e' }}>Sell Price</span>
                                <strong style={{ color: '#e6edf3' }}>{Number(row.sellPrice || 0).toFixed(2)} BHD</strong>
                            </div>

                            <div style={{ display: 'grid', gap: '0.25rem' }}>
                                <span style={{ fontSize: '0.78rem', color: '#8b949e' }}>Quantity</span>
                                <strong style={{ color: '#e6edf3' }}>{Number(row.quantity || 0)}</strong>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {showAddModal && (
                <div onClick={closeAddModal} style={overlayStyle}>
                    <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
                        <form onSubmit={handleAddRow} style={{ display: 'grid', gap: '1rem', padding: '1.25rem 1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e6edf3' }}>Add Inventory Row</div>
                                    <div style={{ marginTop: '0.25rem', fontSize: '0.82rem', color: '#8b949e' }}>
                                        Create a new purchase/sell/qty batch. Existing rows stay read-only.
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
                                    Close
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                                <label style={{ display: 'grid', gap: '0.45rem' }}>
                                    <span>Purchase Price (BHD)</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={draftRow.purchasePrice}
                                        onChange={(event) => setDraftRow((current) => ({ ...current, purchasePrice: event.target.value }))}
                                        style={fieldStyle}
                                    />
                                </label>

                                <label style={{ display: 'grid', gap: '0.45rem' }}>
                                    <span>Sell Price (BHD)</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={draftRow.sellPrice}
                                        onChange={(event) => setDraftRow((current) => ({ ...current, sellPrice: event.target.value }))}
                                        style={fieldStyle}
                                    />
                                </label>

                                <label style={{ display: 'grid', gap: '0.45rem' }}>
                                    <span>Quantity</span>
                                    <input
                                        type="number"
                                        required
                                        value={draftRow.quantity}
                                        onChange={(event) => setDraftRow((current) => ({ ...current, quantity: event.target.value }))}
                                        style={fieldStyle}
                                    />
                                </label>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
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
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '0.65rem 0.9rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: '#238636',
                                        color: '#fff',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Add Row
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryPricingEditor;
