import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { i18n } from '../../i18n';
import { adminAlign } from './adminUi.js';
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

const DetailField = ({ label, value, isAr }) => {
    const align = adminAlign(isAr);
    return (
        <div style={{ display: 'grid', gap: '0.2rem', textAlign: align }}>
            <div style={{ fontSize: '0.72rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}
            </div>
            <div style={{ color: '#e6edf3', lineHeight: 1.45 }}>{value || 'N/A'}</div>
        </div>
    );
};

const AdminInventoryMaster = ({ lang = 'ar' }) => {
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

    const isAr = lang === 'ar';

    const t = (path) => {
        const keys = path.split('.');
        let result = i18n[lang];
        if (!result) return path;
        for (const key of keys) {
            result = result[key];
            if (!result) return path;
        }
        return result || path;
    };

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const itemsSnapshot = await getDocs(collection(db, 'items'));
            const itemRecords = itemsSnapshot.docs.map((snapshot) => normalizeMasterRecord({
                id: snapshot.id,
                raw: snapshot.data(),
                sourceType: 'normal',
                sourceLabel: isAr ? 'منتج عادي' : 'Normal Item'
            }));

            const partsSnapshot = await getDocs(collection(db, 'configurator_parts'));
            const partOptionsRecords = [];
            for (const partDoc of partsSnapshot.docs) {
                const part = { id: partDoc.id, ...partDoc.data() };
                const optionsSnapshot = await getDocs(collection(db, `configurator_parts/${part.id}/options`));
                optionsSnapshot.docs.forEach((optDoc) => {
                    partOptionsRecords.push(normalizeMasterRecord({
                        id: optDoc.id,
                        raw: optDoc.data(),
                        sourceType: 'configurator',
                        sourceLabel: `${isAr ? 'مخصص' : 'Configurator'} / ${part.title || part.id}`,
                        partId: part.id,
                        partTitle: part.title || part.id
                    }));
                });
            }

            setRecords([...itemRecords, ...partOptionsRecords]);
        } catch (e) {
            console.error("Error fetching inventory:", e);
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
            alert(isAr ? 'فشل في حفظ المخزون' : 'Failed to save inventory');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <LoadingState message={isAr ? "جاري تحميل المخزون..." : "Loading inventory..."} minHeight="32vh" />;

    return (
        <div style={{ display: 'grid', gap: '1rem', direction: isAr ? 'rtl' : 'ltr' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1.5fr) repeat(2, minmax(180px, 0.8fr))', gap: '0.9rem' }}>
                <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
                    <span style={{ color: '#8b949e' }}>{isAr ? "البحث بالاسم، الرقم أو الباركود" : "Search by item, item number, or barcode"}</span>
                    <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={t('admin.inventory.search')}
                        style={fieldStyle}
                    />
                </label>

                <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
                    <span style={{ color: '#8b949e' }}>{isAr ? "المصدر" : "Source"}</span>
                    <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} style={fieldStyle}>
                        <option value="all">{isAr ? "جميع المصادر" : "All Sources"}</option>
                        <option value="normal">{isAr ? "منتجات عادية" : "Normal Items"}</option>
                        <option value="configurator">{isAr ? "أجزاء المخصص" : "Configurator Options"}</option>
                    </select>
                </label>

                <label style={{ display: 'grid', gap: '0.45rem', textAlign: adminAlign(isAr) }}>
                    <span style={{ color: '#8b949e' }}>{isAr ? "المخزون" : "Stock"}</span>
                    <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} style={fieldStyle}>
                        <option value="all">{t('admin.inventory.all')}</option>
                        <option value="in_stock">{t('admin.inventory.inStock')}</option>
                        <option value="out_of_stock">{t('admin.inventory.outStock')}</option>
                    </select>
                </label>
            </div>

            <div style={{ color: '#8b949e', textAlign: adminAlign(isAr) }}>
                {filteredRecords.length} {isAr ? "سجل مخزون" : "inventory record(s)"}
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
                        letterSpacing: '0.08em',
                        textAlign: adminAlign(isAr)
                    }}
                >
                    <div>{isAr ? "الرقم" : "ID"}</div>
                    <div>{t('admin.inventory.columns.barcode')}</div>
                    <div>{t('admin.inventory.columns.item')}</div>
                    <div>{t('admin.inventory.columns.source')}</div>
                    <div>{t('admin.inventory.columns.price')}</div>
                    <div>{t('admin.inventory.columns.quantity')}</div>
                    <div>{t('admin.inventory.status')}</div>
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
                                textAlign: adminAlign(isAr),
                                cursor: 'pointer'
                            }}
                        >
                            <div style={{ fontFamily: 'Consolas, monospace' }}>#{padNumericString(record.itemNumber)}</div>
                            <div style={{ fontFamily: 'Consolas, monospace' }}>{record.barcode}</div>
                            <div>
                                <div>{record.name}</div>
                                <div style={{ fontSize: '0.76rem', color: '#8b949e', marginTop: '0.2rem' }}>
                                    {record.sourceType === 'configurator' ? `${isAr ? "جزء:" : "Part:"} ${record.sourceLabel}` : (record.category || (isAr ? 'بدون تصنيف' : 'Uncategorized'))}
                                </div>
                            </div>
                            <div>{record.sourceType === 'normal' ? (isAr ? 'منتج عادي' : 'Normal Item') : (isAr ? 'خيار مخصص' : 'Configurator Option')}</div>
                            <div>{formatInventoryMoney(record.sellPrice ?? record.price)}</div>
                            <div>{record.quantity ?? 0}</div>
                            <div>{Number(record.quantity || 0) > 0 ? (isAr ? 'متوفر' : 'In Stock') : (isAr ? 'نفد' : 'Out')}</div>
                        </button>
                    ))}
                    {filteredRecords.length === 0 && (
                        <div style={{ padding: '1.2rem', color: '#8b949e', textAlign: adminAlign(isAr) }}>
                            {isAr ? "لا توجد سجلات مخزون تطابق الفلتر الحالي." : "No inventory records matched your filters."}
                        </div>
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
                                background: '#161b22',
                                flexDirection: isAr ? 'row-reverse' : 'row'
                            }}
                        >
                            <div style={{ textAlign: adminAlign(isAr) }}>
                                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e6edf3' }}>{selectedRecord.name}</div>
                                <div style={{ marginTop: '0.3rem', color: '#8b949e' }}>
                                    #{padNumericString(selectedRecord.itemNumber)} · {selectedRecord.sourceType === 'normal' ? (isAr ? 'منتج عادي' : 'Normal Item') : `${isAr ? 'مخصص' : 'Configurator'} / ${selectedRecord.sourceLabel}`}
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
                                    {isAr ? 'إغلاق' : 'Close'}
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
                                    {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ المخزون' : 'Save Inventory')}
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem', padding: '1.25rem 1.5rem', direction: isAr ? 'rtl' : 'ltr', textAlign: adminAlign(isAr) }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem' }}>
                                    <DetailField isAr={isAr} label={isAr ? "رقم الصنف" : "Item Number"} value={padNumericString(selectedRecord.itemNumber)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField isAr={isAr} label={isAr ? "الباركود" : "Barcode"} value={selectedRecord.barcode} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField isAr={isAr} label={isAr ? "المصدر" : "Source"} value={selectedRecord.sourceType === 'normal' ? (isAr ? 'منتج عادي' : 'Normal Item') : `${isAr ? 'مخصص' : 'Configurator'} / ${selectedRecord.sourceLabel}`} />
                                </div>

                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem' }}>
                                    <DetailField isAr={isAr} label={isAr ? "سعر البيع" : "Sell Price"} value={formatInventoryMoney(selectedRecord.sellPrice ?? selectedRecord.price)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField isAr={isAr} label={isAr ? "سعر الشراء" : "Purchase Price"} value={formatInventoryMoney(selectedRecord.purchasePrice)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField isAr={isAr} label={t('admin.inventory.inHand')} value={String(selectedRecord.quantity ?? 0)} />
                                </div>
                            </div>

                            {selectedRecord.sourceType === 'normal' && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#e6edf3', flexDirection: isAr ? 'row-reverse' : 'row', justifyContent: isAr ? 'flex-end' : 'flex-start' }}>
                                    <input
                                        type="checkbox"
                                        checked={formState.showOnline}
                                        onChange={(event) => setFormState((current) => ({ ...current, showOnline: event.target.checked }))}
                                    />
                                    {isAr ? "عرض في المتجر" : "Show Online"}
                                </label>
                            )}

                            <InventoryPricingEditor
                                rows={formState.inventoryDetails}
                                onChange={(inventoryDetails) => setFormState((current) => ({ ...current, inventoryDetails }))}
                                title={isAr ? "حركات المخزون" : "Stock Movements"}
                                description={isAr ? "أضف حركات المخزون بالكمية والتاريخ والسبب. يتم إدارة الأسعار من المنتج الأصلي." : "Add stock movements with quantity, date, and reason. Pricing is managed on the original item or configurator option."}
                                lang={lang}
                            />

                            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ fontWeight: 700, color: '#e6edf3', marginBottom: '0.75rem', textAlign: adminAlign(isAr) }}>{t('admin.inventory.history')}</div>
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
                                            <DetailField isAr={isAr} label={t('admin.inventory.reason')} value={getInventoryReasonLabel(row.reason, lang)} />
                                            <DetailField isAr={isAr} label={isAr ? "التاريخ" : "Date"} value={formatInventoryDate(row.date)} />
                                            <DetailField isAr={isAr} label={t('admin.inventory.columns.quantity')} value={`${Number(row.quantity || 0) > 0 ? '+' : ''}${row.quantity ?? 0}`} />
                                            <DetailField isAr={isAr} label={isAr ? "ملاحظة / المصدر" : "Note / Source"} value={row.note || row.source || (isAr ? 'يدوي' : 'manual')} />
                                        </div>
                                    ))}
                                    {(!formState.inventoryDetails || formState.inventoryDetails.length === 0) && (
                                        <div style={{ color: '#8b949e', textAlign: adminAlign(isAr) }}>{isAr ? "لا توجد حركات مخزون مسجلة." : "No inventory movements recorded."}</div>
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
