import React, { useEffect, useMemo, useState } from 'react';
import { db, storage } from '../../firebase';
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import InventoryPricingEditor from './InventoryPricingEditor';
import LoadingState from '../../components/LoadingState.jsx';
import {
    buildInventoryPayload,
    createInventoryEntry,
    formatInventoryMoney,
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
    inventoryDetails: [createInventoryEntry({ purchasePrice: 0, sellPrice: 0, quantity: 0, isActive: true })]
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

const listCellStyle = {
    minWidth: 0,
    textAlign: 'left'
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
        sellPrice: raw.sellPrice ?? raw.price ?? 0,
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

const AdminItems = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [detailOpen, setDetailOpen] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState(createEmptyFormData);
    const [imageFiles, setImageFiles] = useState(null);
    const [saving, setSaving] = useState(false);

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
            const inventoryPayload = buildInventoryPayload(formData.inventoryDetails, {
                purchasePrice: 0,
                sellPrice: 0,
                quantity: 0
            });
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
            alert('Error saving item');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this item?')) return;
        try {
            await deleteDoc(doc(db, 'items', id));
            if (selectedItemId === id) {
                setSelectedItemId('');
                setDetailOpen(false);
            }
            await fetchItems();
        } catch (error) {
            console.error(error);
            alert('Error deleting item');
        }
    };

    if (loading) return <LoadingState message="Loading items..." minHeight="32vh" />;

    return (
        <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ color: '#8b949e' }}>Manage normal inventory items from a single list. Click an item row for full details.</div>
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
                    Add New Item
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
                    <div style={listCellStyle}>Item</div>
                    <div style={listCellStyle}>Category</div>
                    <div style={listCellStyle}>Sell Price</div>
                    <div style={listCellStyle}>Purchase</div>
                    <div style={listCellStyle}>Stock</div>
                    <div style={listCellStyle}>Visibility</div>
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
                                    textAlign: 'left',
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
                                            #{padNumericString(item.itemNumber)} · {item.description || 'No description'}
                                    </div>
                                </div>
                            </div>
                                <div style={listCellStyle}>{item.category || 'N/A'}</div>
                                <div style={listCellStyle}>{formatInventoryMoney(item.sellPrice ?? item.price)}</div>
                                <div style={listCellStyle}>{formatInventoryMoney(item.purchasePrice)}</div>
                                <div style={listCellStyle}>{item.quantity ?? 0}</div>
                                <div style={listCellStyle}>{item.showOnline ? 'Live' : 'Hidden'}</div>
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
                                background: '#161b22'
                            }}
                        >
                            <div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e6edf3' }}>{selectedItem.name}</div>
                                <div style={{ marginTop: '0.3rem', color: '#8b949e' }}>{selectedItem.category || 'Uncategorized'}</div>
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
                                    Edit
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
                                    Delete
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
                                    Close
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem', padding: '1.25rem 1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem' }}>
                                    <DetailField label="Item Number" value={padNumericString(selectedItem.itemNumber)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField label="Barcode" value={selectedItem.barcode} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField label="Sell Price" value={formatInventoryMoney(selectedItem.sellPrice ?? selectedItem.price)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField label="Purchase Price" value={formatInventoryMoney(selectedItem.purchasePrice)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField label="Stock" value={String(selectedItem.quantity ?? 0)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField label="Visibility" value={selectedItem.showOnline ? 'Live' : 'Hidden'} />
                                </div>

                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem' }}>
                                    <DetailField label="Created" value={formatDate(selectedItem.createdAt)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField label="Updated" value={formatDate(selectedItem.updatedAt)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField label="Inventory Rows" value={String(selectedItem.inventoryDetails?.length || 0)} />
                                </div>
                            </div>

                            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ fontWeight: 700, color: '#e6edf3', marginBottom: '0.75rem' }}>Active Inventory on Platform</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                    <DetailField label="Purchase Price" value={formatInventoryMoney(selectedItem.purchasePrice)} />
                                    <DetailField label="Sell Price" value={formatInventoryMoney(selectedItem.sellPrice ?? selectedItem.price)} />
                                    <DetailField label="Quantity" value={String(selectedItem.quantity ?? 0)} />
                                </div>
                            </div>

                            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ fontWeight: 700, color: '#e6edf3', marginBottom: '0.75rem' }}>Inventory Rows</div>
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
                                                border: row.isActive ? '1px solid #1f6feb' : '1px solid #30363d',
                                                background: row.isActive ? 'rgba(31, 111, 235, 0.08)' : '#111827'
                                            }}
                                        >
                                            <DetailField label="Row" value={`Inventory Row ${index + 1}`} />
                                            <DetailField label="Purchase Price" value={formatInventoryMoney(row.purchasePrice)} />
                                            <DetailField label="Sell Price" value={formatInventoryMoney(row.sellPrice)} />
                                            <DetailField label="Quantity" value={String(row.quantity ?? 0)} />
                                            <DetailField label="Platform Status" value={row.isActive ? 'Active' : 'Inactive'} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ fontWeight: 700, color: '#e6edf3', marginBottom: '0.75rem' }}>Description</div>
                                <div style={{ color: '#d6d9e0', lineHeight: 1.6 }}>{selectedItem.description || 'No description provided.'}</div>
                            </div>

                            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ fontWeight: 700, color: '#e6edf3', marginBottom: '0.75rem' }}>Images</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
                                    {(selectedItem.images || []).map((image, index) => (
                                        <img key={`${selectedItem.id}-image-${index}`} src={image} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px' }} />
                                    ))}
                                    {(!selectedItem.images || selectedItem.images.length === 0) && (
                                        <div style={{ color: '#8b949e' }}>No images uploaded.</div>
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
                        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', padding: '1.25rem 1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e6edf3' }}>
                                        {editingId ? 'Edit Item' : 'Add New Item'}
                                    </div>
                                    <div style={{ marginTop: '0.3rem', color: '#8b949e' }}>
                                        {editingId ? 'Update inventory rows, pricing, and storefront stock from one place.' : 'Create a new normal item for the shop.'}
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
                                    Close
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                <label style={{ display: 'grid', gap: '0.45rem' }}>
                                    <span>Item Number</span>
                                    <input value={padNumericString(formData.itemNumber) || 'Auto-generated on save'} readOnly style={fieldStyle} />
                                </label>

                                <label style={{ display: 'grid', gap: '0.45rem' }}>
                                    <span>Barcode</span>
                                    <input value={padNumericString(formData.barcode) || padNumericString(formData.itemNumber) || 'Matches item number on save'} readOnly style={fieldStyle} />
                                </label>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                <label style={{ display: 'grid', gap: '0.45rem' }}>
                                    <span>Item Name</span>
                                    <input name="name" value={formData.name} onChange={handleFormChange} required style={fieldStyle} />
                                </label>

                                <label style={{ display: 'grid', gap: '0.45rem' }}>
                                    <span>Category</span>
                                    <select name="category" value={formData.category} onChange={handleFormChange} style={fieldStyle}>
                                        <option value="Accessories">Accessories</option>
                                        <option value="Controllers">Controllers</option>
                                        <option value="Mod Kits">Mod Kits</option>
                                    </select>
                                </label>
                            </div>

                            <label style={{ display: 'grid', gap: '0.45rem' }}>
                                <span>Description</span>
                                <textarea name="description" value={formData.description} onChange={handleFormChange} style={{ ...fieldStyle, minHeight: '120px', resize: 'vertical' }} />
                            </label>

                            <InventoryPricingEditor
                                rows={formData.inventoryDetails}
                                onChange={(inventoryDetails) => setFormData((current) => ({ ...current, inventoryDetails }))}
                                title="Inventory, Purchase Price, and Sell Price"
                                description="Create multiple quantity-price rows. The active row drives the live sell price and stock shown on the platform."
                            />

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#e6edf3' }}>
                                <input type="checkbox" name="showOnline" checked={formData.showOnline} onChange={handleFormChange} />
                                Show Online
                            </label>

                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                <span>Images</span>
                                <input type="file" multiple accept="image/*" onChange={(event) => setImageFiles(event.target.files)} style={{ color: '#e6edf3' }} />
                                {editingId && (
                                    <div style={{ fontSize: '0.8rem', color: '#8b949e' }}>
                                        Uploading new images replaces the existing image set.
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
                                    Cancel
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
                                    {saving ? 'Saving...' : (editingId ? 'Update Item' : 'Create Item')}
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
