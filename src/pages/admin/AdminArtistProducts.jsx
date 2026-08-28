import React, { useEffect, useMemo, useState } from 'react';
import { adminAlign } from './adminUi.js';
import {
    adminCreateDoc,
    adminDeleteDoc,
    adminListDocs,
    adminPatchDoc,
    adminUploadFile
} from '../../services/backendApi.js';
import InventoryPricingEditor from './InventoryPricingEditor';
import LoadingState from '../../components/LoadingState.jsx';
import {
    DEFAULT_ARTIST_CATEGORIES,
    categoryLabels,
    mapArtistProductRecord,
    normalizeArtistCategory,
    slugifyArtistId,
    sortArtistCategories
} from '../../lib/artistProducts.js';
import {
    buildInventoryPayload,
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

const LIST_COLUMNS = '1.8fr 0.9fr 0.85fr 0.7fr 0.8fr';

const emptyForm = () => ({
    slug: '',
    nameEn: '',
    nameAr: '',
    artistEn: '',
    artistAr: '',
    category: '',
    cardEn: '',
    cardAr: '',
    bioEn: '',
    bioAr: '',
    storyEn: '',
    storyAr: '',
    showOnline: true,
    images: [],
    itemNumber: '',
    barcode: '',
    purchasePrice: '0',
    sellPrice: '0',
    inventoryDetails: []
});

const overlayStyle = {
    position: 'fixed',
    inset: 0,
    background: 'var(--admin-overlay-soft)',
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
    border: '1px solid var(--admin-border)',
    background: 'var(--admin-raised)',
    color: 'var(--admin-text)'
};

const AdminArtistProducts = ({ lang = 'ar' }) => {
    const isAr = lang === 'ar';
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState(emptyForm);
    const [imageFiles, setImageFiles] = useState([]);
    const [saving, setSaving] = useState(false);
    const [categories, setCategories] = useState([]);
    const [categoryForm, setCategoryForm] = useState({ id: '', en: '', ar: '', sortOrder: '0' });
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [savingCategory, setSavingCategory] = useState(false);

    const fetchCategories = async () => {
        const snapshot = await adminListDocs('artist_categories/');
        const list = snapshot.docs.map((snap) => {
            const { path, ...data } = snap;
            void path;
            return normalizeArtistCategory(data, snap.id);
        });
        setCategories(sortArtistCategories(list));
    };

    const fetchProducts = async () => {
        try {
            const snapshot = await adminListDocs('artist_products/');
            const list = snapshot.docs.map((snap) => {
                const { path, ...data } = snap;
                void path;
                return {
                    ...mapArtistProductRecord(snap.id, data),
                    ...buildInventoryPayload(data.inventoryDetails, {
                        purchasePrice: data.purchasePrice ?? 0,
                        sellPrice: data.sellPrice ?? data.price ?? 0
                    }, {
                        quantity: data.quantity ?? 0
                    }),
                    itemNumber: getInventoryItemNumber({ id: snap.id, ...data }),
                    barcode: getBarcodeValue({ id: snap.id, ...data }),
                    inventoryDetails: data.inventoryDetails || []
                };
            });
            setProducts(list);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                await Promise.all([fetchProducts(), fetchCategories()]);
            } catch (error) {
                console.error(error);
            }
            setLoading(false);
        })();
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setFormData({
            ...emptyForm(),
            category: categories[0]?.id || ''
        });
        setImageFiles([]);
        setFormOpen(true);
    };

    const openEdit = (product) => {
        setEditingId(product.id);
        setFormData({
            slug: product.id,
            nameEn: product.nameEn || '',
            nameAr: product.nameAr || '',
            artistEn: product.artistEn || '',
            artistAr: product.artistAr || '',
            category: product.category || categories[0]?.id || '',
            cardEn: product.cardEn || '',
            cardAr: product.cardAr || '',
            bioEn: product.bioEn || '',
            bioAr: product.bioAr || '',
            storyEn: product.storyEn || '',
            storyAr: product.storyAr || '',
            showOnline: product.showOnline !== false,
            images: product.gallery || product.images || [],
            itemNumber: getInventoryItemNumber(product),
            barcode: getBarcodeValue(product),
            purchasePrice: String(product.purchasePrice ?? 0),
            sellPrice: String(product.sellPrice ?? product.price ?? 0),
            inventoryDetails: hydrateInventoryFormEntries(product)
        });
        setImageFiles([]);
        setFormOpen(true);
    };

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;
        setFormData((current) => ({
            ...current,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const uploadImages = async () => {
        const uploaded = [];
        for (const file of imageFiles) {
            const { url } = await adminUploadFile(file);
            uploaded.push(url);
        }
        return [...(formData.images || []), ...uploaded];
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!String(formData.nameEn || '').trim()) {
            alert(isAr ? 'اسم المنتج بالإنجليزية مطلوب.' : 'English product name is required.');
            return;
        }
        if (!formData.category) {
            alert(isAr ? 'اختر فئة.' : 'Please choose a category.');
            return;
        }
        setSaving(true);
        try {
            const images = await uploadImages();
            const labels = categoryLabels(formData.category, categories);
            const inventoryPayload = buildInventoryPayload(
                formData.inventoryDetails,
                {
                    purchasePrice: formData.purchasePrice,
                    sellPrice: formData.sellPrice
                },
                { quantity: 0 }
            );
            const itemNumber = normalizeNumericString(formData.itemNumber) || await allocateSequentialNumber(undefined, 'inventory_master');
            const barcode = normalizeNumericString(formData.barcode) || itemNumber;
            const payload = {
                productKind: 'artist',
                name: String(formData.nameEn).trim(),
                nameEn: String(formData.nameEn).trim(),
                nameAr: String(formData.nameAr || formData.nameEn).trim(),
                artistEn: String(formData.artistEn || '').trim(),
                artistAr: String(formData.artistAr || formData.artistEn || '').trim(),
                category: formData.category,
                categoryEn: labels.categoryEn,
                categoryAr: labels.categoryAr,
                cardEn: String(formData.cardEn || '').trim(),
                cardAr: String(formData.cardAr || formData.cardEn || '').trim(),
                bioEn: String(formData.bioEn || '').trim(),
                bioAr: String(formData.bioAr || formData.bioEn || '').trim(),
                storyEn: String(formData.storyEn || '').trim(),
                storyAr: String(formData.storyAr || formData.storyEn || '').trim(),
                showOnline: Boolean(formData.showOnline),
                images,
                image: images[0] || '',
                itemNumber,
                barcode,
                inventoryDetails: inventoryPayload.inventoryDetails,
                purchasePrice: inventoryPayload.purchasePrice,
                sellPrice: inventoryPayload.sellPrice,
                price: inventoryPayload.price,
                quantity: inventoryPayload.quantity,
                updatedAt: new Date().toISOString()
            };

            if (editingId) {
                await adminPatchDoc(`artist_products/${editingId}`, payload);
            } else {
                const slug = slugifyArtistId(formData.slug || formData.nameEn) || `design-${Date.now()}`;
                await adminCreateDoc({
                    collection: 'artist_products',
                    docId: slug,
                    data: {
                        ...payload,
                        createdAt: new Date().toISOString()
                    }
                });
            }

            setFormOpen(false);
            await fetchProducts();
        } catch (error) {
            console.error(error);
            alert(isAr ? 'تعذر حفظ منتج الفنان.' : 'Error saving artist product.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(isAr ? 'حذف هذا التصميم؟' : 'Delete this design?')) return;
        try {
            await adminDeleteDoc(`artist_products/${id}`);
            await fetchProducts();
        } catch (error) {
            console.error(error);
            alert(isAr ? 'تعذر الحذف.' : 'Error deleting product.');
        }
    };

    const resetCategoryForm = () => {
        setEditingCategoryId(null);
        setCategoryForm({ id: '', en: '', ar: '', sortOrder: String(categories.length) });
    };

    const openEditCategory = (category) => {
        setEditingCategoryId(category.id);
        setCategoryForm({
            id: category.id,
            en: category.en || '',
            ar: category.ar || '',
            sortOrder: String(category.sortOrder ?? 0)
        });
    };

    const handleSaveCategory = async (event) => {
        event.preventDefault();
        const en = String(categoryForm.en || '').trim();
        const ar = String(categoryForm.ar || '').trim();
        if (!en) {
            alert(isAr ? 'اسم الفئة بالإنجليزية مطلوب.' : 'English category name is required.');
            return;
        }
        const id = editingCategoryId || slugifyArtistId(categoryForm.id || en);
        if (!id) {
            alert(isAr ? 'معرّف الفئة غير صالح.' : 'Category id is invalid.');
            return;
        }
        if (!editingCategoryId && categories.some((item) => item.id === id)) {
            alert(isAr ? 'هذه الفئة موجودة مسبقاً.' : 'That category already exists.');
            return;
        }
        setSavingCategory(true);
        try {
            const payload = {
                id,
                en,
                ar: ar || en,
                sortOrder: Number(categoryForm.sortOrder) || 0,
                updatedAt: new Date().toISOString()
            };
            if (editingCategoryId) {
                await adminPatchDoc(`artist_categories/${editingCategoryId}`, payload);
                const labels = { categoryEn: payload.en, categoryAr: payload.ar || payload.en };
                await Promise.all(
                    products
                        .filter((product) => product.category === editingCategoryId)
                        .map((product) => adminPatchDoc(`artist_products/${product.id}`, labels))
                );
            } else {
                await adminCreateDoc({
                    collection: 'artist_categories',
                    docId: id,
                    data: {
                        ...payload,
                        createdAt: new Date().toISOString()
                    }
                });
            }
            resetCategoryForm();
            await Promise.all([fetchCategories(), fetchProducts()]);
        } catch (error) {
            console.error(error);
            alert(isAr ? 'تعذر حفظ الفئة.' : 'Error saving category.');
        } finally {
            setSavingCategory(false);
        }
    };

    const handleDeleteCategory = async (category) => {
        const used = products.filter((product) => product.category === category.id).length;
        if (used > 0) {
            alert(isAr
                ? `لا يمكن حذف هذه الفئة لأنها مستخدمة في ${used} تصميم.`
                : `This category cannot be deleted because ${used} design(s) still use it.`);
            return;
        }
        if (!window.confirm(isAr ? 'حذف هذه الفئة؟' : 'Delete this category?')) return;
        try {
            await adminDeleteDoc(`artist_categories/${category.id}`);
            if (editingCategoryId === category.id) resetCategoryForm();
            await fetchCategories();
        } catch (error) {
            console.error(error);
            alert(isAr ? 'تعذر حذف الفئة.' : 'Error deleting category.');
        }
    };

    const seedDefaultCategories = async () => {
        setSavingCategory(true);
        try {
            await Promise.all(DEFAULT_ARTIST_CATEGORIES.map((item, index) => adminCreateDoc({
                collection: 'artist_categories',
                docId: item.id,
                data: {
                    ...normalizeArtistCategory(item, item.id),
                    sortOrder: index,
                    createdAt: new Date().toISOString()
                }
            })));
            await fetchCategories();
        } catch (error) {
            console.error(error);
            alert(isAr ? 'تعذر إضافة الفئات الافتراضية.' : 'Error adding default categories.');
        } finally {
            setSavingCategory(false);
        }
    };

    const removeExistingImage = (index) => {
        setFormData((current) => ({
            ...current,
            images: (current.images || []).filter((_, i) => i !== index)
        }));
    };

    const listCellStyle = useMemo(() => ({ minWidth: 0, textAlign: adminAlign(isAr) }), [isAr]);

    if (loading) {
        return <LoadingState message={isAr ? 'جاري تحميل تصاميم الفنانين...' : 'Loading artist products...'} minHeight="32vh" />;
    }

    return (
        <div style={{ display: 'grid', gap: '1rem', direction: isAr ? 'rtl' : 'ltr' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ color: 'var(--admin-muted)' }}>
                    {isAr
                        ? 'أنشئ تصاميم صفحة الفنانين مع الصور والمخزون. الشراء يستخدم نفس سلة ودفع المخصص.'
                        : 'Create Artists page designs with photos and stock. Purchase uses the same cart, checkout, and payment as the configurator.'}
                </div>
                <button
                    type="button"
                    onClick={openCreate}
                    style={{ padding: '0.7rem 1rem', borderRadius: '8px', border: 'none', background: '#238636', color: 'var(--admin-on-primary)', fontWeight: 700, cursor: 'pointer' }}
                >
                    {isAr ? 'إضافة تصميم' : 'Add Design'}
                </button>
            </div>

            <section style={{ background: 'var(--admin-surface)', border: '1px solid var(--admin-border)', borderRadius: '10px', padding: '1rem 1.15rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <div>
                        <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{isAr ? 'فئات صفحة الفنانين' : 'Artist categories'}</div>
                        <div style={{ marginTop: '0.25rem', color: 'var(--admin-muted)', fontSize: '0.85rem' }}>
                            {isAr ? 'أضف أو عدّل أو احذف الفئات التي تظهر في فلاتر المتجر.' : 'Add, edit, or delete the filters shown on the Artists page.'}
                        </div>
                    </div>
                </div>
                <form onSubmit={handleSaveCategory} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem', alignItems: 'end', marginBottom: '1rem' }}>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>{isAr ? 'المعرّف' : 'ID'}</span>
                        <input
                            value={categoryForm.id}
                            onChange={(e) => setCategoryForm((current) => ({ ...current, id: e.target.value }))}
                            disabled={!!editingCategoryId}
                            placeholder="premium"
                            style={{ ...fieldStyle, color: editingCategoryId ? 'var(--admin-muted)' : 'var(--admin-text)' }}
                        />
                    </label>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>EN</span>
                        <input value={categoryForm.en} onChange={(e) => setCategoryForm((current) => ({ ...current, en: e.target.value }))} style={fieldStyle} />
                    </label>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>AR</span>
                        <input value={categoryForm.ar} onChange={(e) => setCategoryForm((current) => ({ ...current, ar: e.target.value }))} style={fieldStyle} />
                    </label>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>{isAr ? 'الترتيب' : 'Order'}</span>
                        <input type="number" value={categoryForm.sortOrder} onChange={(e) => setCategoryForm((current) => ({ ...current, sortOrder: e.target.value }))} style={fieldStyle} />
                    </label>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <button type="submit" disabled={savingCategory} style={{ padding: '0.65rem 0.9rem', borderRadius: 6, border: 'none', background: '#1f6feb', color: 'var(--admin-on-primary)', fontWeight: 700, cursor: savingCategory ? 'wait' : 'pointer' }}>
                            {editingCategoryId ? (isAr ? 'تحديث الفئة' : 'Update category') : (isAr ? 'إضافة فئة' : 'Add category')}
                        </button>
                        {editingCategoryId && (
                            <button type="button" onClick={resetCategoryForm} style={{ padding: '0.65rem 0.9rem', borderRadius: 6, border: '1px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}>
                                {isAr ? 'إلغاء' : 'Cancel'}
                            </button>
                        )}
                    </div>
                </form>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                    {categories.map((item) => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', padding: '0.55rem 0.7rem', background: 'var(--admin-raised)', border: '1px solid var(--admin-border)', borderRadius: 8 }}>
                            <div>
                                <strong style={{ color: 'var(--admin-text)' }}>{isAr ? item.ar : item.en}</strong>
                                <div style={{ fontSize: '0.75rem', color: 'var(--admin-muted)' }}>{item.id} · {isAr ? item.en : item.ar}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button type="button" onClick={() => openEditCategory(item)} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: '#1f6feb', color: 'var(--admin-on-primary)', cursor: 'pointer' }}>
                                    {isAr ? 'تعديل' : 'Edit'}
                                </button>
                                <button type="button" onClick={() => handleDeleteCategory(item)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #f85149', background: 'transparent', color: '#ff7b72', cursor: 'pointer' }}>
                                    {isAr ? 'حذف' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    ))}
                    {categories.length === 0 && (
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', color: 'var(--admin-muted)', fontSize: '0.85rem' }}>
                            <span>{isAr ? 'لا توجد فئات بعد. أضف فئة قبل إنشاء التصاميم.' : 'No categories yet. Add one before creating designs.'}</span>
                            <button type="button" disabled={savingCategory} onClick={seedDefaultCategories} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text-secondary)', cursor: savingCategory ? 'wait' : 'pointer' }}>
                                {isAr ? 'إضافة الفئات الافتراضية' : 'Add default categories'}
                            </button>
                        </div>
                    )}
                </div>
            </section>

            <section className="admin-oracle-list">
                <div className="admin-oracle-list__header-grid" style={{ gridTemplateColumns: LIST_COLUMNS, textAlign: adminAlign(isAr) }}>
                    <div style={listCellStyle}>{isAr ? 'التصميم' : 'Design'}</div>
                    <div style={listCellStyle}>{isAr ? 'الفئة' : 'Category'}</div>
                    <div style={listCellStyle}>{isAr ? 'السعر' : 'Price'}</div>
                    <div style={listCellStyle}>{isAr ? 'المخزون' : 'Stock'}</div>
                    <div style={listCellStyle}>{isAr ? 'الحالة' : 'Status'}</div>
                </div>
                <div className="admin-oracle-list__body" style={{ display: 'grid' }}>
                    {products.map((product) => (
                        <div
                            key={product.id}
                            className="admin-oracle-list__row-btn"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: LIST_COLUMNS,
                                gap: '0.75rem',
                                alignItems: 'center',
                                padding: '0.85rem 1rem',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: '1px solid var(--admin-border)',
                                color: 'var(--admin-text)',
                                textAlign: adminAlign(isAr)
                            }}
                        >
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', minWidth: 0 }}>
                                {product.image ? (
                                    <img src={product.image} alt="" style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                                ) : (
                                    <div style={{ width: 54, height: 54, borderRadius: 8, background: 'var(--admin-hover-alt)', flexShrink: 0 }} />
                                )}
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {isAr ? product.nameAr : product.nameEn}
                                    </div>
                                    <div style={{ fontSize: '0.76rem', color: 'var(--admin-muted)' }}>
                                        {isAr ? product.artistAr : product.artistEn} · #{padNumericString(product.itemNumber)}
                                    </div>
                                </div>
                            </div>
                            <div>{isAr ? product.categoryAr : product.categoryEn}</div>
                            <div>{formatInventoryMoney(product.sellPrice ?? product.price)}</div>
                            <div>{product.quantity ?? 0}</div>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <span>{product.showOnline ? (isAr ? 'ظاهر' : 'Live') : (isAr ? 'مخفي' : 'Hidden')}</span>
                                <button type="button" onClick={() => openEdit(product)} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: '#1f6feb', color: 'var(--admin-on-primary)', cursor: 'pointer' }}>
                                    {isAr ? 'تعديل' : 'Edit'}
                                </button>
                                <button type="button" onClick={() => handleDelete(product.id)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #f85149', background: 'transparent', color: '#ff7b72', cursor: 'pointer' }}>
                                    {isAr ? 'حذف' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    ))}
                    {products.length === 0 && (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--admin-muted)' }}>
                            {isAr ? 'لا توجد تصاميم بعد.' : 'No artist designs yet.'}
                        </div>
                    )}
                </div>
            </section>

            {formOpen && (
                <div onClick={() => setFormOpen(false)} style={overlayStyle}>
                    <div
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            width: 'min(920px, 100%)',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            background: 'var(--admin-surface)',
                            border: '1px solid var(--admin-border)',
                            borderRadius: '14px'
                        }}
                    >
                        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', padding: '1.25rem 1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--admin-text)' }}>
                                        {editingId ? (isAr ? 'تعديل التصميم' : 'Edit Design') : (isAr ? 'تصميم فنان جديد' : 'New Artist Design')}
                                    </div>
                                    <div style={{ marginTop: '0.3rem', color: 'var(--admin-muted)' }}>
                                        {isAr ? 'الصور تظهر في صفحة الفنان. المخزون يُخصم عند الدفع مثل المخصص.' : 'Photos appear on the Artists page. Stock deducts at payment like the configurator.'}
                                    </div>
                                </div>
                                <button type="button" onClick={() => setFormOpen(false)} style={{ padding: '0.5rem 0.8rem', borderRadius: 6, border: '1px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}>
                                    {isAr ? 'إغلاق' : 'Close'}
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                                <label style={{ display: 'grid', gap: '0.35rem' }}>
                                    <span style={{ color: 'var(--admin-text-secondary)' }}>{isAr ? 'رابط الصفحة (إنجليزي)' : 'URL slug'}</span>
                                    <input name="slug" value={formData.slug} onChange={handleChange} disabled={!!editingId} placeholder="sakura-bloom" style={{ ...fieldStyle, color: editingId ? 'var(--admin-muted)' : 'var(--admin-text)' }} />
                                </label>
                                <label style={{ display: 'grid', gap: '0.35rem' }}>
                                    <span style={{ color: 'var(--admin-text-secondary)' }}>{isAr ? 'الفئة' : 'Category'}</span>
                                    <select name="category" value={formData.category} onChange={handleChange} style={fieldStyle} disabled={categories.length === 0}>
                                        {categories.length === 0 && (
                                            <option value="">{isAr ? 'أضف فئة أولاً' : 'Add a category first'}</option>
                                        )}
                                        {categories.map((item) => (
                                            <option key={item.id} value={item.id}>{isAr ? item.ar : item.en}</option>
                                        ))}
                                    </select>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.6rem' }}>
                                    <input type="checkbox" name="showOnline" checked={formData.showOnline} onChange={handleChange} />
                                    <span style={{ color: 'var(--admin-text-secondary)' }}>{isAr ? 'ظاهر في المتجر' : 'Show on Artists page'}</span>
                                </label>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                                {[
                                    ['nameEn', isAr ? 'اسم التصميم EN' : 'Name (EN)'],
                                    ['nameAr', isAr ? 'اسم التصميم AR' : 'Name (AR)'],
                                    ['artistEn', isAr ? 'اسم الفنان EN' : 'Artist (EN)'],
                                    ['artistAr', isAr ? 'اسم الفنان AR' : 'Artist (AR)']
                                ].map(([name, label]) => (
                                    <label key={name} style={{ display: 'grid', gap: '0.35rem' }}>
                                        <span style={{ color: 'var(--admin-text-secondary)' }}>{label}</span>
                                        <input name={name} value={formData[name]} onChange={handleChange} style={fieldStyle} />
                                    </label>
                                ))}
                            </div>

                            {[
                                ['cardEn', 'cardAr', isAr ? 'وصف البطاقة' : 'Card copy'],
                                ['bioEn', 'bioAr', isAr ? 'نبذة' : 'Bio'],
                                ['storyEn', 'storyAr', isAr ? 'القصة' : 'Story']
                            ].map(([enKey, arKey, label]) => (
                                <div key={enKey} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                                    <label style={{ display: 'grid', gap: '0.35rem' }}>
                                        <span style={{ color: 'var(--admin-text-secondary)' }}>{label} EN</span>
                                        <textarea name={enKey} value={formData[enKey]} onChange={handleChange} rows={3} style={fieldStyle} />
                                    </label>
                                    <label style={{ display: 'grid', gap: '0.35rem' }}>
                                        <span style={{ color: 'var(--admin-text-secondary)' }}>{label} AR</span>
                                        <textarea name={arKey} value={formData[arKey]} onChange={handleChange} rows={3} style={fieldStyle} />
                                    </label>
                                </div>
                            ))}

                            <div>
                                <div style={{ color: 'var(--admin-text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>{isAr ? 'صور المعرض' : 'Gallery photos'}</div>
                                <input type="file" accept="image/*" multiple onChange={(e) => setImageFiles(Array.from(e.target.files || []))} style={{ color: 'var(--admin-text)' }} />
                                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                                    {(formData.images || []).map((src, index) => (
                                        <div key={`${src}-${index}`} style={{ position: 'relative' }}>
                                            <img src={src} alt="" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 8 }} />
                                            <button type="button" onClick={() => removeExistingImage(index)} style={{ position: 'absolute', top: 4, right: 4, background: '#000a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                                                {isAr ? 'حذف' : 'Remove'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <InventoryPricingEditor
                                rows={formData.inventoryDetails}
                                onChange={(inventoryDetails) => setFormData((current) => ({ ...current, inventoryDetails }))}
                                title={isAr ? 'المخزون' : 'Inventory'}
                                description={isAr ? 'أضف حركات المخزون. سعر البيع يظهر للعميل على صفحة الفنان.' : 'Add stock movements. Sell price is what customers see on the Artists page.'}
                                lang={lang}
                            />

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                                <label style={{ display: 'grid', gap: '0.35rem' }}>
                                    <span style={{ color: 'var(--admin-text-secondary)' }}>{isAr ? 'سعر الشراء' : 'Purchase price'}</span>
                                    <input type="number" step="0.01" min="0" name="purchasePrice" value={formData.purchasePrice} onChange={handleChange} style={fieldStyle} />
                                </label>
                                <label style={{ display: 'grid', gap: '0.35rem' }}>
                                    <span style={{ color: 'var(--admin-text-secondary)' }}>{isAr ? 'سعر البيع' : 'Sell price'}</span>
                                    <input type="number" step="0.01" min="0" name="sellPrice" value={formData.sellPrice} onChange={handleChange} style={fieldStyle} />
                                </label>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button type="button" onClick={() => setFormOpen(false)} style={{ padding: '0.6rem 1.1rem', borderRadius: 6, border: '1px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}>
                                    {isAr ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button type="submit" disabled={saving} style={{ padding: '0.6rem 1.1rem', borderRadius: 6, border: 'none', background: '#1f6feb', color: 'var(--admin-on-primary)', fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
                                    {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (editingId ? (isAr ? 'تحديث' : 'Update') : (isAr ? 'حفظ' : 'Save'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminArtistProducts;
