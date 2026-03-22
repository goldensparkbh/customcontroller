import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import InventoryPricingEditor from './InventoryPricingEditor';
import LoadingState from '../../components/LoadingState.jsx';
import {
    buildInventoryPayload,
    formatInventoryDate,
    formatInventoryMoney,
    getInventoryReasonLabel,
    hydrateInventoryFormEntries
} from './inventoryPricing';
import {
    getBarcodeValue,
    getInventoryItemNumber,
    padNumericString
} from './recordNumbers';

const LIST_COLUMNS = '0.8fr 0.9fr 1.7fr 1fr 0.75fr 0.75fr 0.8fr';

const panelStyle = {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '10px',
    overflow: 'hidden'
};

const modalOverlayStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(3, 7, 18, 0.78)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    zIndex: 1200
};

const fieldStyle = {
    width: '100%',
    padding: '0.7rem 0.8rem',
    borderRadius: '8px',
    border: '1px solid #30363d',
    background: '#0d1117',
    color: '#e6edf3'
};

const normalizeMasterRecord = ({ id, raw, sourceType, sourceLabel, partId = '', partTitle = '' }) => ({
    id: `${sourceType}:${id}`,
    documentId: id,
    sourceType,
    sourceLabel,
    partId,
    partTitle,
    name: raw.name || 'Unnamed',
    category: raw.category || '',
    showOnline: raw.showOnline ?? true,
    itemNumber: getInventoryItemNumber({ id, ...raw }),
    barcode: getBarcodeValue({ id, ...raw }),
    ...raw,
    ...buildInventoryPayload(raw.inventoryDetails, {
        purchasePrice: raw.purchasePrice ?? 0,
        sellPrice: raw.sellPrice ?? raw.price ?? 0
    }, {
        quantity: raw.quantity ?? 0
    })
});

const DetailField = ({ label, value }) => (
    <div style={{ display: 'grid', gap: '0.2rem' }}>
        <div style={{ fontSize: '0.72rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
        </div>
        <div style={{ color: '#e6edf3', lineHeight: 1.45 }}>{value || 'N/A'}</div>
    </div>
);

const AdminInventoryMaster = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [stockFilter, setStockFilter] = useState('all');
    const [selectedRecordId, setSelectedRecordId] = useState('');
    const [detailOpen, setDetailOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formState, setFormState] = useState({
        inventoryDetails: [],
        showOnline: true
    });

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const itemsSnapshot = await getDocs(collection(db, 'items'));
            const itemRecords = itemsSnapshot.docs.map((snapshot) => normalizeMasterRecord({
                id: snapshot.id,
                raw: snapshot.data(),
                sourceType: 'normal',
                sourceLabel: 'Normal Item'
            }));

            const partsSnapshot = await getDocs(collection(db, 'configurator_parts'));
            const parts = partsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
            const optionsByPart = await Promise.all(parts.map(async (part) => {
                const optionsSnapshot = await getDocs(collection(db, `configurator_parts/${part.id}/options`));
                return optionsSnapshot.docs.map((snapshot) => normalizeMasterRecord({
                    id: snapshot.id,
                    raw: snapshot.data(),
                    sourceType: 'configurator',
                    sourceLabel: part.title || part.id,
                    partId: part.id,
                    partTitle: part.title || part.id
                }));
            }));

            const nextRecords = [...itemRecords, ...optionsByPart.flat()]
                .sort((a, b) => Number(b.itemNumber || 0) - Number(a.itemNumber || 0));
            setRecords(nextRecords);
            setSelectedRecordId((current) => (nextRecords.some((record) => record.id === current) ? current : ''));
        } catch (error) {
            console.error('Failed to load inventory master', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchInventory();
    }, []);

    useEffect(() => {
        if (!detailOpen) return undefined;
        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setDetailOpen(false);
        };
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [detailOpen]);

    const filteredRecords = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        return records.filter((record) => {
            const matchesSource = sourceFilter === 'all' || record.sourceType === sourceFilter;
            const qty = Number(record.quantity || 0);
            const matchesStock =
                stockFilter === 'all' ||
                (stockFilter === 'in_stock' && qty > 0) ||
                (stockFilter === 'out_of_stock' && qty <= 0);
            const haystack = [
                record.name,
                record.barcode,
                record.itemNumber,
                record.sourceLabel,
                record.partTitle,
                record.category
            ].join(' ').toLowerCase();
            const matchesSearch = !normalizedQuery || haystack.includes(normalizedQuery);
            return matchesSource && matchesStock && matchesSearch;
        });
    }, [records, searchQuery, sourceFilter, stockFilter]);

    const selectedRecord = useMemo(
        () => records.find((record) => record.id === selectedRecordId) || null,
        [records, selectedRecordId]
    );

    const openDetail = (record) => {
        setSelectedRecordId(record.id);
        setFormState({
            inventoryDetails: hydrateInventoryFormEntries(record),
            showOnline: record.showOnline ?? true
        });
        setDetailOpen(true);
    };

    const handleSave = async () => {
        if (!selectedRecord || saving) return;
        setSaving(true);
        try {
            const inventoryPayload = buildInventoryPayload(formState.inventoryDetails, {
                purchasePrice: selectedRecord.purchasePrice ?? 0,
                sellPrice: selectedRecord.sellPrice ?? selectedRecord.price ?? 0
            }, {
                quantity: selectedRecord.quantity ?? 0
            });

            const payload = {
                inventoryDetails: inventoryPayload.inventoryDetails,
                quantity: inventoryPayload.quantity,
                updatedAt: new Date()
            };

            if (selectedRecord.sourceType === 'normal') {
                payload.showOnline = formState.showOnline;
                await updateDoc(doc(db, 'items', selectedRecord.documentId), payload);
            } else {
                await updateDoc(doc(db, `configurator_parts/${selectedRecord.partId}/options`, selectedRecord.documentId), payload);
            }

            await fetchInventory();
            setDetailOpen(false);
        } catch (error) {
            console.error('Failed to save inventory record', error);
            alert('Failed to save inventory');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <LoadingState message="Loading inventory..." minHeight="32vh" />;

    return (
        <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1.5fr) repeat(2, minmax(180px, 0.8fr))', gap: '0.9rem' }}>
                <label style={{ display: 'grid', gap: '0.45rem' }}>
                    <span style={{ color: '#8b949e' }}>Search by item, item number, or barcode</span>
                    <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search inventory..."
                        style={fieldStyle}
                    />
                </label>

                <label style={{ display: 'grid', gap: '0.45rem' }}>
                    <span style={{ color: '#8b949e' }}>Source</span>
                    <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} style={fieldStyle}>
                        <option value="all">All Sources</option>
                        <option value="normal">Normal Items</option>
                        <option value="configurator">Configurator Options</option>
                    </select>
                </label>

                <label style={{ display: 'grid', gap: '0.45rem' }}>
                    <span style={{ color: '#8b949e' }}>Stock</span>
                    <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} style={fieldStyle}>
                        <option value="all">All Stock</option>
                        <option value="in_stock">In Stock</option>
                        <option value="out_of_stock">Out of Stock</option>
                    </select>
                </label>
            </div>

            <div style={{ color: '#8b949e' }}>
                {filteredRecords.length} inventory record(s)
            </div>

            <section style={panelStyle}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: LIST_COLUMNS,
                        gap: '0.75rem',
                        padding: '0.85rem 1rem',
                        background: '#0d1117',
                        borderBottom: '1px solid #30363d',
                        fontSize: '0.72rem',
                        color: '#8b949e',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em'
                    }}
                >
                    <div>ID</div>
                    <div>Barcode</div>
                    <div>Item</div>
                    <div>Source</div>
                    <div>Sell</div>
                    <div>Qty</div>
                    <div>Status</div>
                </div>

                <div style={{ display: 'grid' }}>
                    {filteredRecords.map((record) => (
                        <button
                            key={record.id}
                            type="button"
                            onClick={() => openDetail(record)}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: LIST_COLUMNS,
                                gap: '0.75rem',
                                padding: '1rem',
                                border: 'none',
                                borderTop: '1px solid rgba(255,255,255,0.05)',
                                background: 'transparent',
                                color: '#e6edf3',
                                textAlign: 'left',
                                cursor: 'pointer'
                            }}
                        >
                            <div style={{ fontFamily: 'Consolas, monospace' }}>#{padNumericString(record.itemNumber)}</div>
                            <div style={{ fontFamily: 'Consolas, monospace' }}>{record.barcode}</div>
                            <div>
                                <div>{record.name}</div>
                                <div style={{ fontSize: '0.76rem', color: '#8b949e', marginTop: '0.2rem' }}>
                                    {record.sourceType === 'configurator' ? `Part: ${record.sourceLabel}` : (record.category || 'Uncategorized')}
                                </div>
                            </div>
                            <div>{record.sourceType === 'normal' ? 'Normal Item' : 'Configurator Option'}</div>
                            <div>{formatInventoryMoney(record.sellPrice ?? record.price)}</div>
                            <div>{record.quantity ?? 0}</div>
                            <div>{Number(record.quantity || 0) > 0 ? 'In Stock' : 'Out'}</div>
                        </button>
                    ))}
                    {filteredRecords.length === 0 && (
                        <div style={{ padding: '1.2rem', color: '#8b949e' }}>No inventory records matched your filters.</div>
                    )}
                </div>
            </section>

            {detailOpen && selectedRecord && (
                <div onClick={() => setDetailOpen(false)} style={modalOverlayStyle}>
                    <div
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        style={{
                            width: 'min(900px, 100%)',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            background: '#161b22',
                            border: '1px solid #30363d',
                            borderRadius: '14px',
                            boxShadow: '0 24px 80px rgba(0,0,0,0.45)'
                        }}
                    >
                        <div
                            style={{
                                position: 'sticky',
                                top: 0,
                                zIndex: 1,
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '1rem',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                padding: '1.25rem 1.5rem',
                                borderBottom: '1px solid #30363d',
                                background: '#161b22'
                            }}
                        >
                            <div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e6edf3' }}>{selectedRecord.name}</div>
                                <div style={{ marginTop: '0.3rem', color: '#8b949e' }}>
                                    #{padNumericString(selectedRecord.itemNumber)} · {selectedRecord.sourceType === 'normal' ? 'Normal Item' : `Configurator / ${selectedRecord.sourceLabel}`}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={() => setDetailOpen(false)}
                                    style={{
                                        padding: '0.55rem 0.8rem',
                                        borderRadius: '6px',
                                        border: '1px solid #3b4452',
                                        background: '#0d1117',
                                        color: '#e6edf3',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving}
                                    style={{
                                        padding: '0.55rem 0.9rem',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: '#238636',
                                        color: '#fff',
                                        fontWeight: 700,
                                        cursor: saving ? 'not-allowed' : 'pointer',
                                        opacity: saving ? 0.7 : 1
                                    }}
                                >
                                    {saving ? 'Saving...' : 'Save Inventory'}
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem', padding: '1.25rem 1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem' }}>
                                    <DetailField label="Item Number" value={padNumericString(selectedRecord.itemNumber)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField label="Barcode" value={selectedRecord.barcode} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField label="Source" value={selectedRecord.sourceType === 'normal' ? 'Normal Item' : `Configurator / ${selectedRecord.sourceLabel}`} />
                                </div>

                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem' }}>
                                    <DetailField label="Sell Price" value={formatInventoryMoney(selectedRecord.sellPrice ?? selectedRecord.price)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField label="Purchase Price" value={formatInventoryMoney(selectedRecord.purchasePrice)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField label="Current Quantity" value={String(selectedRecord.quantity ?? 0)} />
                                </div>
                            </div>

                            {selectedRecord.sourceType === 'normal' && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#e6edf3' }}>
                                    <input
                                        type="checkbox"
                                        checked={formState.showOnline}
                                        onChange={(event) => setFormState((current) => ({ ...current, showOnline: event.target.checked }))}
                                    />
                                    Show Online
                                </label>
                            )}

                            <InventoryPricingEditor
                                rows={formState.inventoryDetails}
                                onChange={(inventoryDetails) => setFormState((current) => ({ ...current, inventoryDetails }))}
                                title="Inventory"
                                description="Add stock movements with quantity, date, and reason. Pricing is managed on the original item or configurator option."
                            />

                            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ fontWeight: 700, color: '#e6edf3', marginBottom: '0.75rem' }}>Inventory History</div>
                                <div style={{ display: 'grid', gap: '0.75rem' }}>
                                    {(formState.inventoryDetails || []).map((row, index) => (
                                        <div
                                            key={row.id || `inventory-entry-${index}`}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                                gap: '0.75rem',
                                                padding: '0.85rem',
                                                borderRadius: '8px',
                                                border: Number(row.quantity || 0) < 0 ? '1px solid rgba(248,113,113,0.35)' : '1px solid #30363d',
                                                background: Number(row.quantity || 0) < 0 ? 'rgba(127,29,29,0.18)' : '#111827'
                                            }}
                                        >
                                            <DetailField label="Reason" value={getInventoryReasonLabel(row.reason)} />
                                            <DetailField label="Date" value={formatInventoryDate(row.date)} />
                                            <DetailField label="Quantity" value={`${Number(row.quantity || 0) > 0 ? '+' : ''}${row.quantity ?? 0}`} />
                                            <DetailField label="Source" value={row.source || 'manual'} />
                                        </div>
                                    ))}
                                    {(!formState.inventoryDetails || formState.inventoryDetails.length === 0) && (
                                        <div style={{ color: '#8b949e' }}>No inventory movements recorded.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminInventoryMaster;
