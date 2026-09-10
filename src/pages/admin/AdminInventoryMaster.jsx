import React, { useEffect, useMemo, useState } from 'react';
import { adminListDocs, adminPatchDoc } from '../../services/backendApi.js';
import { i18n } from '../../i18n';
import LoadingState from '../../components/LoadingState.jsx';
import AdminTable, { AdminTableRow } from './components/AdminTable.jsx';
import AdminDetailModal from './components/AdminDetailModal.jsx';
import AdminStockBadge from './components/AdminStockBadge.jsx';
import { adminAlign } from './adminUi.js';
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

import InventoryPricingEditor from './InventoryPricingEditor';

const sourceLabelFor = (record, isAr) => {
    if (record.sourceType === 'normal') return isAr ? 'منتج متجر' : 'Shop item';
    if (record.sourceType === 'artist') return isAr ? 'تصميم فنان' : 'Artist design';
    return isAr ? 'خيار مخصص' : 'Configurator option';
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
            <div style={{ fontSize: '0.72rem', color: 'var(--admin-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}
            </div>
            <div style={{ color: 'var(--admin-text)', lineHeight: 1.45 }}>{value || 'N/A'}</div>
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
            const itemsSnapshot = await adminListDocs('items/');
            const itemRecords = itemsSnapshot.docs.map((snapshot) => {
                const { path, ...data } = snapshot;
                void path;
                return normalizeMasterRecord({
                    id: snapshot.id,
                    raw: data,
                    sourceType: 'normal',
                    sourceLabel: isAr ? 'منتج عادي' : 'Normal Item'
                });
            });

            const artistSnapshot = await adminListDocs('artist_products/');
            const artistRecords = artistSnapshot.docs.map((snapshot) => {
                const { path, ...data } = snapshot;
                void path;
                return normalizeMasterRecord({
                    id: snapshot.id,
                    raw: { ...data, name: data.nameEn || data.name, category: data.category },
                    sourceType: 'artist',
                    sourceLabel: isAr ? 'منتج فنان' : 'Artist Product'
                });
            });

            const partsSnapshot = await adminListDocs('configurator_parts/');
            const rootParts = partsSnapshot.docs.filter((d) => /^configurator_parts\/[^/]+$/u.test(d.path));

            const partOptionsRecords = [];
            for (const partDoc of rootParts) {
                const { path, ... pdata } = partDoc;
                void path;
                const part = { id: partDoc.id, ...pdata };
                const optionsSnapshot = await adminListDocs(`configurator_parts/${part.id}/options/`);
                optionsSnapshot.docs.forEach((optDoc) => {
                    const { path: op, ...odata } = optDoc;
                    void op;
                    partOptionsRecords.push(normalizeMasterRecord({
                        id: optDoc.id,
                        raw: odata,
                        sourceType: 'configurator',
                        sourceLabel: `${isAr ? 'مخصص' : 'Configurator'} / ${part.title || part.id}`,
                        partId: part.id,
                        partTitle: part.title || part.id
                    }));
                });
            }

            setRecords([...itemRecords, ...artistRecords, ...partOptionsRecords]);
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
                (stockFilter === 'low_stock' && qty > 0 && qty <= 5) ||
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

    const stockStats = useMemo(() => {
        const qtyOf = (record) => Number(record.quantity || 0);
        return {
            total: records.length,
            inStock: records.filter((record) => qtyOf(record) > 5).length,
            low: records.filter((record) => qtyOf(record) > 0 && qtyOf(record) <= 5).length,
            out: records.filter((record) => qtyOf(record) <= 0).length
        };
    }, [records]);

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
                updatedAt: new Date().toISOString()
            };

            if (selectedRecord.sourceType === 'normal') {
                payload.showOnline = formState.showOnline;
                await adminPatchDoc(`items/${selectedRecord.documentId}`, payload);
            } else if (selectedRecord.sourceType === 'artist') {
                payload.showOnline = formState.showOnline;
                await adminPatchDoc(`artist_products/${selectedRecord.documentId}`, payload);
            } else {
                await adminPatchDoc(
                    `configurator_parts/${selectedRecord.partId}/options/${selectedRecord.documentId}`,
                    payload
                );
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

    const tableColumns = [
        { key: 'id', label: isAr ? 'الرقم' : 'ID', mono: true },
        { key: 'barcode', label: t('admin.inventory.columns.barcode'), mono: true },
        { key: 'item', label: t('admin.inventory.columns.item') },
        { key: 'source', label: t('admin.inventory.columns.source') },
        { key: 'price', label: t('admin.inventory.columns.price'), numeric: true },
        { key: 'qty', label: t('admin.inventory.columns.quantity'), numeric: true },
        { key: 'status', label: t('admin.inventory.status') }
    ];

    return (
        <div style={{ display: 'grid', gap: '1rem', direction: isAr ? 'rtl' : 'ltr' }}>
            <div className="admin-stat-grid">
                <div className="admin-stat-card">
                    <div className="admin-stat-card__label">{t('admin.inventory.statsTotal')}</div>
                    <div className="admin-stat-card__value">{stockStats.total}</div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-card__label">{t('admin.inventory.statsIn')}</div>
                    <div className="admin-stat-card__value">{stockStats.inStock}</div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-card__label">{t('admin.inventory.statsLow')}</div>
                    <div className="admin-stat-card__value">{stockStats.low}</div>
                </div>
                <div className="admin-stat-card">
                    <div className="admin-stat-card__label">{t('admin.inventory.statsOut')}</div>
                    <div className="admin-stat-card__value">{stockStats.out}</div>
                </div>
            </div>

            <div className="admin-toolbar-filters">
                <label className="admin-field">
                    <span>{isAr ? "البحث بالاسم، الرقم أو الباركود" : "Search by name, item number, or barcode"}</span>
                    <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={t('admin.inventory.search')}
                    />
                </label>
                <label className="admin-field">
                    <span>{isAr ? "المصدر" : "Source"}</span>
                    <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                        <option value="all">{isAr ? "جميع المصادر" : "All sources"}</option>
                        <option value="normal">{isAr ? "منتجات المتجر" : "Shop items"}</option>
                        <option value="artist">{isAr ? "تصاميم الفنانين" : "Artist designs"}</option>
                        <option value="configurator">{isAr ? "أجزاء المخصص" : "Configurator options"}</option>
                    </select>
                </label>
                <label className="admin-field">
                    <span>{isAr ? "المخزون" : "Stock"}</span>
                    <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
                        <option value="all">{t('admin.inventory.all')}</option>
                        <option value="in_stock">{t('admin.inventory.inStock')}</option>
                        <option value="low_stock">{t('admin.inventory.lowStock')}</option>
                        <option value="out_of_stock">{t('admin.inventory.outStock')}</option>
                    </select>
                </label>
            </div>

            <div style={{ color: 'var(--admin-muted)', textAlign: adminAlign(isAr) }}>
                {filteredRecords.length} {t('admin.inventory.records')}
            </div>

            <AdminTable
                lang={lang}
                columns={tableColumns}
                emptyMessage={isAr ? "لا توجد سجلات مخزون تطابق الفلتر الحالي." : "No inventory records matched your filters."}
            >
                {filteredRecords.map((record) => (
                    <AdminTableRow key={record.id} onClick={() => openDetail(record)}>
                        <td className="admin-table__cell--mono">#{padNumericString(record.itemNumber)}</td>
                        <td className="admin-table__cell--mono">{record.barcode}</td>
                        <td>
                            <div className="admin-cell-title">{record.name}</div>
                            <div className="admin-cell-meta">
                                {record.sourceType === 'configurator'
                                    ? `${isAr ? "جزء:" : "Part:"} ${record.partTitle || record.sourceLabel}`
                                    : (record.category || (isAr ? 'بدون تصنيف' : 'Uncategorized'))}
                            </div>
                        </td>
                        <td><span className="admin-chip">{sourceLabelFor(record, isAr)}</span></td>
                        <td className="admin-table__cell--numeric">{formatInventoryMoney(record.sellPrice ?? record.price)}</td>
                        <td className="admin-table__cell--numeric">{record.quantity ?? 0}</td>
                        <td><AdminStockBadge qty={record.quantity} lang={lang} /></td>
                    </AdminTableRow>
                ))}
            </AdminTable>

            <AdminDetailModal
                open={detailOpen && !!selectedRecord}
                onClose={() => setDetailOpen(false)}
                isAr={isAr}
                width="min(900px, 100%)"
                title={selectedRecord?.name}
                subtitle={selectedRecord ? `#${padNumericString(selectedRecord.itemNumber)} · ${sourceLabelFor(selectedRecord, isAr)}` : ''}
            >
                {selectedRecord && (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                            <button type="button" className="admin-btn admin-btn--primary" onClick={handleSave} disabled={saving}>
                                {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ المخزون' : 'Save inventory')}
                            </button>
                        </div>
                        <div className="admin-detail-grid">
                            <div className="admin-detail-card">
                                <DetailField isAr={isAr} label={isAr ? "رقم الصنف" : "Item number"} value={padNumericString(selectedRecord.itemNumber)} />
                                <div style={{ height: '0.75rem' }} />
                                <DetailField isAr={isAr} label={isAr ? "الباركود" : "Barcode"} value={selectedRecord.barcode} />
                                <div style={{ height: '0.75rem' }} />
                                <DetailField isAr={isAr} label={isAr ? "المصدر" : "Source"} value={sourceLabelFor(selectedRecord, isAr)} />
                            </div>
                            <div className="admin-detail-card">
                                <DetailField isAr={isAr} label={isAr ? "سعر البيع" : "Sell price"} value={formatInventoryMoney(selectedRecord.sellPrice ?? selectedRecord.price)} />
                                <div style={{ height: '0.75rem' }} />
                                <DetailField isAr={isAr} label={isAr ? "سعر الشراء" : "Purchase price"} value={formatInventoryMoney(selectedRecord.purchasePrice)} />
                                <div style={{ height: '0.75rem' }} />
                                <DetailField isAr={isAr} label={t('admin.inventory.inHand')} value={<AdminStockBadge qty={selectedRecord.quantity} lang={lang} />} />
                            </div>
                        </div>

                        {(selectedRecord.sourceType === 'normal' || selectedRecord.sourceType === 'artist') && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--admin-text)' }}>
                                <input
                                    type="checkbox"
                                    checked={formState.showOnline}
                                    onChange={(event) => setFormState((current) => ({ ...current, showOnline: event.target.checked }))}
                                />
                                {isAr ? "عرض في المتجر" : "Show online"}
                            </label>
                        )}

                        <InventoryPricingEditor
                            rows={formState.inventoryDetails}
                            onChange={(inventoryDetails) => setFormState((current) => ({ ...current, inventoryDetails }))}
                            title={isAr ? "حركات المخزون" : "Stock movements"}
                            description={isAr ? "أضف حركة لزيادة أو إنقاص الكمية مع التاريخ والسبب. الأسعار تُدار من شاشة المنتج الأصلية." : "Add a movement to increase or decrease quantity, with date and reason. Prices are edited on the original product screen."}
                            lang={lang}
                        />

                        <div className="admin-detail-card">
                            <div style={{ fontWeight: 700, color: 'var(--admin-text)', marginBottom: '0.75rem' }}>{t('admin.inventory.history')}</div>
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                {(formState.inventoryDetails || []).map((row, index) => (
                                    <div
                                        key={row.id || `inventory-entry-${index}`}
                                        className={`admin-movement-card${Number(row.quantity || 0) < 0 ? ' is-out' : ''}`}
                                    >
                                        <DetailField isAr={isAr} label={t('admin.inventory.reason')} value={getInventoryReasonLabel(row.reason, lang)} />
                                        <DetailField isAr={isAr} label={isAr ? "التاريخ" : "Date"} value={formatInventoryDate(row.date)} />
                                        <DetailField isAr={isAr} label={t('admin.inventory.columns.quantity')} value={`${Number(row.quantity || 0) > 0 ? '+' : ''}${row.quantity ?? 0}`} />
                                        <DetailField isAr={isAr} label={isAr ? "ملاحظة / المصدر" : "Note / source"} value={row.note || row.source || (isAr ? 'يدوي' : 'manual')} />
                                    </div>
                                ))}
                                {(!formState.inventoryDetails || formState.inventoryDetails.length === 0) && (
                                    <div style={{ color: 'var(--admin-muted)' }}>{isAr ? "لا توجد حركات مخزون مسجلة." : "No inventory movements recorded."}</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </AdminDetailModal>
        </div>
    );
};


export default AdminInventoryMaster;
