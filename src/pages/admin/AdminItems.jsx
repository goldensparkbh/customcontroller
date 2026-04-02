import React, { useEffect, useMemo, useState } from 'react';
import { adminAlign } from './adminUi.js';
import { db, storage } from '../../firebase';
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import InventoryPricingEditor from './InventoryPricingEditor';
import LoadingState from '../../components/LoadingState.jsx';
import { i18n } from '../../i18n';
import {
    buildInventoryPayload,
    formatInventoryDate,
    formatInventoryMoney,
    getInventoryReasonLabel,
    hydrateInventoryFormEntries
} from './inventoryPricing';
import {
    allocateSequentialNumber,
    getBarcodeValue,
    getInventoryItemNumber,
    normalizeNumericString,
    padNumericString
} from './recordNumbers';

const LIST_COLUMNS = '1.6fr 0.9fr 0.85fr 0.85fr 0.7fr 0.8fr';

const createEmptyFormData = () => ({
    name: '',
    description: '',
    category: 'Accessories',
    showOnline: true,
    images: [],
    itemNumber: '',
    barcode: '',
    purchasePrice: '0',
    sellPrice: '0',
    inventoryDetails: []
});

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

const panelStyle = {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '10px',
    overflow: 'hidden'
};

const fieldStyle = {
    width: '100%',
    padding: '0.7rem 0.8rem',
    borderRadius: '8px',
    border: '1px solid #30363d',
    background: '#0d1117',
    color: '#e6edf3'
};

const listCellBase = {
    minWidth: 0
};

const formatDate = (value) => {
    if (!value) return 'N/A';
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
};

const normalizeItemRecord = (id, raw = {}) => ({
    id,
    ...raw,
    itemNumber: getInventoryItemNumber({ id, ...raw }),
    barcode: getBarcodeValue({ id, ...raw }),
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

const AdminItems = ({ lang = 'ar' }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [detailOpen, setDetailOpen] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState(createEmptyFormData);
    const [imageFiles, setImageFiles] = useState(null);
    const [saving, setSaving] = useState(false);

    const isAr = lang === 'ar';
    const listCellStyle = useMemo(() => ({ ...listCellBase, textAlign: adminAlign(isAr) }), [isAr]);

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

    const fetchItems = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'items'));
            const itemsList = querySnapshot.docs.map((snapshot) => normalizeItemRecord(snapshot.id, snapshot.data()));
            setItems(itemsList);
            setSelectedItemId((current) => (itemsList.some((item) => item.id === current) ? current : ''));
        } catch (error) {
            console.error('Error fetching items:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const selectedItem = useMemo(
        () => items.find((item) => item.id === selectedItemId) || null,
        [items, selectedItemId]
    );

    useEffect(() => {
        const isAnyModalOpen = detailOpen || formOpen;
        if (!isAnyModalOpen) return undefined;
        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setDetailOpen(false);
                setFormOpen(false);
            }
        };
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [detailOpen, formOpen]);

    const openCreateModal = () => {
        setEditingId(null);
        setFormData(createEmptyFormData());
        setImageFiles(null);
        setFormOpen(true);
    };

    const openEditModal = (item) => {
        setEditingId(item.id);
        setSelectedItemId(item.id);
        setFormData({
            name: item.name || '',
            description: item.description || '',
            category: item.category || 'Accessories',
            showOnline: item.showOnline ?? true,
            images: item.images || [],
            itemNumber: getInventoryItemNumber(item),
            barcode: getBarcodeValue(item),
            purchasePrice: String(item.purchasePrice ?? 0),
            sellPrice: String(item.sellPrice ?? item.price ?? 0),
            inventoryDetails: hydrateInventoryFormEntries(item)
        });
        setImageFiles(null);
        setDetailOpen(false);
        setFormOpen(true);
    };

    const openDetailModal = (itemId) => {
        setSelectedItemId(itemId);
        setDetailOpen(true);
    };

    const handleFormChange = (event) => {
        const { name, value, type, checked } = event.target;
        setFormData((current) => ({
            ...current,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const uploadSelectedImages = async () => {
        if (!imageFiles || imageFiles.length === 0) return formData.images || [];
        const nextUrls = [];
        for (let index = 0; index < imageFiles.length; index += 1) {
            const file = imageFiles[index];
            const storageRef = ref(storage, `shop_items/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            nextUrls.push(await getDownloadURL(storageRef));
        }
        return nextUrls;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            const uploadedImages = await uploadSelectedImages();
            const itemNumber = normalizeNumericString(formData.itemNumber);
            const inventoryPayload = buildInventoryPayload(
                formData.inventoryDetails,
                {
                    purchasePrice: formData.purchasePrice,
                    sellPrice: formData.sellPrice
                },
                {
                    quantity: 0,
                    createdAt: editingId ? undefined : new Date()
                }
            );
            const nextItemNumber = itemNumber || await allocateSequentialNumber(db, 'inventory_master');
            const barcode = normalizeNumericString(formData.barcode) || nextItemNumber;
            const itemData = {
                name: formData.name,
                description: formData.description,
                category: formData.category,
                showOnline: formData.showOnline,
                images: uploadedImages,
                itemNumber: nextItemNumber,
                barcode,
                inventoryDetails: inventoryPayload.inventoryDetails,
                purchasePrice: inventoryPayload.purchasePrice,
                sellPrice: inventoryPayload.sellPrice,
                price: inventoryPayload.price,
                quantity: inventoryPayload.quantity,
                updatedAt: new Date()
            };

            if (editingId) {
                await updateDoc(doc(db, 'items', editingId), itemData);
            } else {
                await addDoc(collection(db, 'items'), {
                    ...itemData,
                    createdAt: new Date()
                });
            }

            setFormOpen(false);
            setEditingId(null);
            setFormData(createEmptyFormData());
            setImageFiles(null);
            await fetchItems();
        } catch (error) {
            console.error(error);
            alert(isAr ? 'خطأ في حفظ المنتج' : 'Error saving item');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(isAr ? 'هل تريد حذف هذا المنتج؟' : 'Delete this item?')) return;
        try {
            await deleteDoc(doc(db, 'items', id));
            if (selectedItemId === id) {
                setSelectedItemId('');
                setDetailOpen(false);
            }
            await fetchItems();
        } catch (error) {
            console.error(error);
            alert(isAr ? 'خطأ في حذف المنتج' : 'Error deleting item');
        }
    };

    if (loading) return <LoadingState message={isAr ? "جاري تحميل المنتجات..." : "Loading items..."} minHeight="32vh" />;

    return (
        <div style={{ display: 'grid', gap: '1rem', direction: isAr ? 'rtl' : 'ltr' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ color: '#8b949e' }}>{isAr ? "إدارة مخزون المنتجات العادية من قائمة واحدة. انقر فوق صف الصنف لمزيد من التفاصيل." : "Manage normal inventory items from a single list. Click an item row for full details."}</div>
                <button
                    type="button"
                    onClick={openCreateModal}
                    style={{
                        padding: '0.7rem 1rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#238636',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: 'pointer'
                    }}
                >
                    {isAr ? "إضافة منتج جديد" : "Add New Item"}
                </button>
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
                    <div style={listCellStyle}>{isAr ? "المنتج" : "Item"}</div>
                    <div style={listCellStyle}>{isAr ? "الفئة" : "Category"}</div>
                    <div style={listCellStyle}>{isAr ? "سعر البيع" : "Sell Price"}</div>
                    <div style={listCellStyle}>{isAr ? "سعر الشراء" : "Purchase"}</div>
                    <div style={listCellStyle}>{isAr ? "المخزون" : "Stock"}</div>
                    <div style={listCellStyle}>{isAr ? "الحالة" : "Visibility"}</div>
                </div>

                <div style={{ display: 'grid' }}>
                    {items.map((item) => {
                        const isSelected = detailOpen && item.id === selectedItemId;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => openDetailModal(item.id)}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: LIST_COLUMNS,
                                    gap: '0.75rem',
                                    padding: '1rem',
                                    border: 'none',
                                    borderTop: '1px solid rgba(255,255,255,0.05)',
                                    background: isSelected ? '#1f2937' : 'transparent',
                                    color: '#e6edf3',
                                    textAlign: adminAlign(isAr),
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{ ...listCellStyle, display: 'flex', gap: '0.75rem' }}>
                                    {item.images?.[0] ? (
                                        <img
                                            src={item.images[0]}
                                            alt={item.name}
                                            style={{ width: '54px', height: '54px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
                                        />
                                    ) : (
                                        <div style={{ width: '54px', height: '54px', borderRadius: '8px', background: '#111827', flexShrink: 0 }} />
                                    )}
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                                    <div style={{ fontSize: '0.76rem', color: '#8b949e', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            #{padNumericString(item.itemNumber)} · {item.description || (isAr ? 'بدون وصف' : 'No description')}
                                    </div>
                                </div>
                            </div>
                                <div style={listCellStyle}>{item.category || 'N/A'}</div>
                                <div style={listCellStyle}>{formatInventoryMoney(item.sellPrice ?? item.price)}</div>
                                <div style={listCellStyle}>{formatInventoryMoney(item.purchasePrice)}</div>
                                <div style={listCellStyle}>{item.quantity ?? 0}</div>
                                <div style={listCellStyle}>{item.showOnline ? (isAr ? 'ظاهر' : 'Live') : (isAr ? 'مخفي' : 'Hidden')}</div>
                            </button>
                        );
                    })}
                </div>
            </section>

            {detailOpen && selectedItem && (
                <div onClick={() => setDetailOpen(false)} style={modalOverlayStyle}>
                    <div
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            width: 'min(980px, 100%)',
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
                            <div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e6edf3' }}>{selectedItem.name}</div>
                                <div style={{ marginTop: '0.3rem', color: '#8b949e' }}>{selectedItem.category || (isAr ? 'بدون تصنيف' : 'Uncategorized')}</div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={() => openEditModal(selectedItem)}
                                    style={{
                                        padding: '0.55rem 0.8rem',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: '#1f6feb',
                                        color: '#fff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {isAr ? 'تعديل' : 'Edit'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(selectedItem.id)}
                                    style={{
                                        padding: '0.55rem 0.8rem',
                                        borderRadius: '6px',
                                        border: '1px solid #f85149',
                                        background: 'transparent',
                                        color: '#ff7b72',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {isAr ? 'حذف' : 'Delete'}
                                </button>
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
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem', padding: '1.25rem 1.5rem', direction: isAr ? 'rtl' : 'ltr' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem' }}>
                                    <DetailField isAr={isAr} label={isAr ? "رقم الصنف" : "Item Number"} value={padNumericString(selectedItem.itemNumber)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField isAr={isAr} label={isAr ? "الباركود" : "Barcode"} value={selectedItem.barcode} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField isAr={isAr} label={isAr ? "سعر البيع" : "Sell Price"} value={formatInventoryMoney(selectedItem.sellPrice ?? selectedItem.price)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField isAr={isAr} label={isAr ? "سعر الشراء" : "Purchase Price"} value={formatInventoryMoney(selectedItem.purchasePrice)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField isAr={isAr} label={isAr ? "المخزون" : "Stock"} value={String(selectedItem.quantity ?? 0)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField isAr={isAr} label={isAr ? "الحالة" : "Visibility"} value={selectedItem.showOnline ? (isAr ? 'ظاهر' : 'Live') : (isAr ? 'مخفي' : 'Hidden')} />
                                </div>

                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem' }}>
                                    <DetailField isAr={isAr} label={isAr ? "تاريخ الإنشاء" : "Created"} value={formatDate(selectedItem.createdAt)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField isAr={isAr} label={isAr ? "تاريخ التحديث" : "Updated"} value={formatDate(selectedItem.updatedAt)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField isAr={isAr} label={isAr ? "سجلات المخزون" : "Inventory Entries"} value={String(selectedItem.inventoryDetails?.length || 0)} />
                                </div>
                            </div>

                            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ fontWeight: 700, color: '#e6edf3', marginBottom: '0.75rem' }}>{isAr ? "التسعير والمخزون" : "Platform Pricing & Stock"}</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                    <DetailField isAr={isAr} label={isAr ? "سعر الشراء" : "Purchase Price"} value={formatInventoryMoney(selectedItem.purchasePrice)} />
                                    <DetailField isAr={isAr} label={isAr ? "سعر البيع" : "Sell Price"} value={formatInventoryMoney(selectedItem.sellPrice ?? selectedItem.price)} />
                                    <DetailField isAr={isAr} label={isAr ? "الكمية" : "Quantity"} value={String(selectedItem.quantity ?? 0)} />
                                </div>
                            </div>

                            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ fontWeight: 700, color: '#e6edf3', marginBottom: '0.75rem' }}>{isAr ? "تاريخ المخزون" : "Inventory History"}</div>
                                <div style={{ display: 'grid', gap: '0.75rem' }}>
                                    {(selectedItem.inventoryDetails || []).map((row, index) => (
                                        <div
                                            key={row.id || `inventory-row-${index}`}
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
                                            <DetailField isAr={isAr} label={isAr ? "إدخال" : "Entry"} value={`${isAr ? "سجل مخزون" : "Inventory Entry"} ${index + 1}`} />
                                            <DetailField isAr={isAr} label={isAr ? "السبب" : "Reason"} value={getInventoryReasonLabel(row.reason, lang)} />
                                            <DetailField isAr={isAr} label={isAr ? "التاريخ" : "Date"} value={formatInventoryDate(row.date)} />
                                            <DetailField isAr={isAr} label={isAr ? "الكمية" : "Quantity"} value={`${Number(row.quantity || 0) > 0 ? '+' : ''}${row.quantity ?? 0}`} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ fontWeight: 700, color: '#e6edf3', marginBottom: '0.75rem' }}>{isAr ? "الوصف" : "Description"}</div>
                                <div style={{ color: '#d6d9e0', lineHeight: 1.6 }}>{selectedItem.description || (isAr ? 'لا يوجد وصف.' : 'No description provided.')}</div>
                            </div>

                            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ fontWeight: 700, color: '#e6edf3', marginBottom: '0.75rem' }}>{isAr ? "الصور" : "Images"}</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
                                    {(selectedItem.images || []).map((image, index) => (
                                        <img key={`${selectedItem.id}-image-${index}`} src={image} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px' }} />
                                    ))}
                                    {(!selectedItem.images || selectedItem.images.length === 0) && (
                                        <div style={{ color: '#8b949e' }}>{isAr ? "لا توجد صور." : "No images uploaded."}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {formOpen && (
                <div onClick={() => setFormOpen(false)} style={modalOverlayStyle}>
                    <div
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            width: 'min(860px, 100%)',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            background: '#161b22',
                            border: '1px solid #30363d',
                            borderRadius: '14px',
                            boxShadow: '0 24px 80px rgba(0,0,0,0.45)'
                        }}
                    >
                        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', padding: '1.25rem 1.5rem', direction: isAr ? 'rtl' : 'ltr' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', flexDirection: isAr ? 'row-reverse' : 'row' }}>
                                <div>
                                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e6edf3' }}>
                                        {editingId ? (isAr ? 'تعديل صنف' : 'Edit Item') : (isAr ? 'إضافة صنف جديد' : 'Add New Item')}
                                    </div>
                                    <div style={{ marginTop: '0.3rem', color: '#8b949e' }}>
                                        {editingId ? (isAr ? 'تحديث الأسعار وحركات المخزون لهذا المنتج.' : 'Update pricing and stock movements for this item.') : (isAr ? 'إنشاء منتج جديد للمتجر.' : 'Create a new normal item for the shop.')}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setFormOpen(false)}
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
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                <label style={{ display: 'grid', gap: '0.45rem' }}>
                                    <span>{isAr ? "رقم الصنف" : "Item Number"}</span>
                                    <input value={padNumericString(formData.itemNumber) || (isAr ? 'توليد تلقائي عند الحفظ' : 'Auto-generated on save')} readOnly style={fieldStyle} />
                                </label>

                                <label style={{ display: 'grid', gap: '0.45rem' }}>
                                    <span>{isAr ? "الباركود" : "Barcode"}</span>
                                    <input value={padNumericString(formData.barcode) || padNumericString(formData.itemNumber) || (isAr ? 'يطابق رقم الصنف عند الحفظ' : 'Matches item number on save')} readOnly style={fieldStyle} />
                                </label>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                <label style={{ display: 'grid', gap: '0.45rem' }}>
                                    <span>{isAr ? "اسم المنتج" : "Item Name"}</span>
                                    <input name="name" value={formData.name} onChange={handleFormChange} required style={fieldStyle} />
                                </label>

                                <label style={{ display: 'grid', gap: '0.45rem' }}>
                                    <span>{isAr ? "الفئة" : "Category"}</span>
                                    <select name="category" value={formData.category} onChange={handleFormChange} style={fieldStyle}>
                                        <option value="Accessories">{isAr ? "إكسسوارات" : "Accessories"}</option>
                                        <option value="Controllers">{isAr ? "وحدات تحكم" : "Controllers"}</option>
                                        <option value="Mod Kits">{isAr ? "أطقم تعديل" : "Mod Kits"}</option>
                                    </select>
                                </label>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                <label style={{ display: 'grid', gap: '0.45rem' }}>
                                    <span>{isAr ? "سعر الشراء" : "Purchase Price"}</span>
                                    <input
                                        name="purchasePrice"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.purchasePrice}
                                        onChange={handleFormChange}
                                        style={fieldStyle}
                                    />
                                </label>

                                <label style={{ display: 'grid', gap: '0.45rem' }}>
                                    <span>{isAr ? "سعر البيع" : "Sell Price"}</span>
                                    <input
                                        name="sellPrice"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.sellPrice}
                                        onChange={handleFormChange}
                                        style={fieldStyle}
                                    />
                                </label>
                            </div>

                            <label style={{ display: 'grid', gap: '0.45rem' }}>
                                <span>{isAr ? "الوصف" : "Description"}</span>
                                <textarea name="description" value={formData.description} onChange={handleFormChange} style={{ ...fieldStyle, minHeight: '120px', resize: 'vertical' }} />
                            </label>

                            <InventoryPricingEditor
                                rows={formData.inventoryDetails}
                                onChange={(inventoryDetails) => setFormData((current) => ({ ...current, inventoryDetails }))}
                                title={isAr ? "المخزون" : "Inventory"}
                                description={isAr ? "أضف حركات المخزون بالكمية والتاريخ والسبب. يتم إدارة سعر البيع بشكل منفصل وهو السعر الذي يراه العميل." : "Add stock movements with quantity, date, and reason. Sell price is managed separately and is the customer-facing price."}
                                lang={lang}
                            />

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#e6edf3' }}>
                                <input type="checkbox" name="showOnline" checked={formData.showOnline} onChange={handleFormChange} />
                                {isAr ? "عرض في المتجر" : "Show Online"}
                            </label>

                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                <span>{isAr ? "الصور" : "Images"}</span>
                                <input type="file" multiple accept="image/*" onChange={(event) => setImageFiles(event.target.files)} style={{ color: '#e6edf3' }} />
                                {editingId && (
                                    <div style={{ fontSize: '0.8rem', color: '#8b949e' }}>
                                        {isAr ? "رفع صور جديدة يستبدل مجموعة الصور الحالية." : "Uploading new images replaces the existing image set."}
                                    </div>
                                )}
                                {formData.images?.length > 0 && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.75rem' }}>
                                        {formData.images.map((image, index) => (
                                            <img key={`form-image-${index}`} src={image} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px' }} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={() => setFormOpen(false)}
                                    style={{
                                        padding: '0.7rem 1rem',
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
                                    type="submit"
                                    disabled={saving}
                                    style={{
                                        padding: '0.7rem 1rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: '#238636',
                                        color: '#fff',
                                        fontWeight: 700,
                                        cursor: saving ? 'not-allowed' : 'pointer',
                                        opacity: saving ? 0.7 : 1
                                    }}
                                >
                                    {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (editingId ? (isAr ? 'تحديث المنتج' : 'Update Item') : (isAr ? 'إنشاء منتج' : 'Create Item'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminItems;
