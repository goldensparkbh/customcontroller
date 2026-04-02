import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../../firebase';
import { collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore';
import { getOrderNumber, padNumericString } from './recordNumbers';
import LoadingState from '../../components/LoadingState.jsx';
import ItemCustomizationSummary from '../../components/ItemCustomizationSummary.jsx';
import { i18n } from '../../i18n';
import { adminAlign } from './adminUi.js';
import {
    WHATSAPP_TEMPLATE_TAGS,
    applyWhatsAppTemplateBody,
    buildWhatsAppTemplateContext,
    loadWhatsAppTemplates,
    saveWhatsAppTemplates
} from './whatsappTemplates';

const LIST_COLUMNS = '1.1fr 1.25fr 0.8fr 0.95fr 0.9fr 0.9fr';
const CHECKBOX_COL_WIDTH = '44px';
const FIRESTORE_BATCH_DELETE_LIMIT = 450;
const ORDER_STATUS_OPTIONS = ['Paid', 'On Going', 'Completed', 'Shipped', 'Canceled'];
const ORDER_URGENCY_OPTIONS = ['Normal', 'Urgent', 'Very Urgent'];

const getItemLineTotal = (item) => {
    const qty = item?.quantity || 1;
    const unit = item?.unitPrice ?? item?.total ?? 0;
    return Number(unit) * qty;
};

const getCustomerName = (order) => {
    const customer = order?.customer || {};
    return [customer.first_name || customer.firstName, customer.last_name || customer.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() || 'N/A';
};

const getPaymentMethod = (order) => order?.payment_method || order?.paymentMethod || 'tap';
const getPaymentStatus = (order) => order?.paymentStatus || 'Pending';
const getPaymentReference = (order) =>
    order?.paymentReference ||
    order?.paymentDetails?.reference?.payment ||
    order?.paymentDetails?.reference?.transaction ||
    order?.paymentDetails?.id ||
    '';
const getOrderNumberLabel = (order) => `#${padNumericString(getOrderNumber(order), 6)}`;
const getTrackingNumber = (order) => order?.shipping?.trackingNumber || '';
const getInventorySyncStatus = (order) => String(order?.inventorySyncStatus || '').trim();
const getInventorySyncError = (order) => String(order?.inventorySyncError || '').trim();
const getInventoryAdjustments = (order) => Array.isArray(order?.inventoryAdjustments) ? order.inventoryAdjustments : [];
const normalizeWhatsAppPhone = (phone) => String(phone || '').replace(/\D/g, '');
const normalizeOrderUrgency = (urgency) => {
    const normalized = String(urgency || '').trim().toLowerCase();
    if (normalized === 'urgent') return 'Urgent';
    if (normalized === 'very urgent' || normalized === 'veryurgent') return 'Very Urgent';
    return 'Normal';
};
const normalizeOrderStatus = (status, order) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'paid') return 'Paid';
    if (normalized === 'on going' || normalized === 'ongoing' || normalized === 'in progress') return 'On Going';
    if (normalized === 'completed') return 'Completed';
    if (normalized === 'shipped') return 'Shipped';
    if (normalized === 'canceled' || normalized === 'cancelled') return 'Canceled';
    if (normalized === 'confirmed') return 'Paid';
    if (normalized === 'pending') return order?.paymentStatus === 'Paid' ? 'Paid' : 'On Going';
    return ORDER_STATUS_OPTIONS.includes(status) ? status : 'On Going';
};
const getUrgencyBadgeStyle = (urgency) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '92px',
    padding: '0.3rem 0.55rem',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontWeight: 700,
    background:
        normalizeOrderUrgency(urgency) === 'Very Urgent' ? '#ef4444' :
            normalizeOrderUrgency(urgency) === 'Urgent' ? '#f97316' : '#64748b',
    color: '#f8fafc'
});

const getFirstPreviewLinks = (order, origin) => {
    const baseUrl = String(origin || '').replace(/\/$/, '');
    if (!baseUrl) return null;
    const items = Array.isArray(order?.items) ? order.items : [];
    const itemIndex = items.findIndex((item) => item?.previewFront || item?.previewBack);
    if (itemIndex < 0) return null;

    const selectedItem = items[itemIndex];
    return {
        front: selectedItem?.previewFront ? `${baseUrl}/api/orderPreview?orderId=${encodeURIComponent(order.id)}&itemIndex=${itemIndex}&side=front` : '',
        back: selectedItem?.previewBack ? `${baseUrl}/api/orderPreview?orderId=${encodeURIComponent(order.id)}&itemIndex=${itemIndex}&side=back` : ''
    };
};

const formatDate = (value) => {
    if (!value) return 'N/A';
    if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
};

const formatAddress = (shipping) => {
    if (!shipping) return 'N/A';
    return [
        shipping.address,
        shipping.addressLine,
        shipping.city,
        shipping.state,
        shipping.country,
        shipping.blockNumber ? `Block ${shipping.blockNumber}` : '',
        shipping.roadNumber ? `Road ${shipping.roadNumber}` : '',
        shipping.houseBuildingNumber ? `Building ${shipping.houseBuildingNumber}` : '',
        shipping.flat ? `Flat ${shipping.flat}` : '',
        shipping.saudiUnifiedAddress ? `Unified Address ${shipping.saudiUnifiedAddress}` : ''
    ].filter(Boolean).join(', ') || 'N/A';
};

const getStatusBadgeStyle = (status) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '88px',
    padding: '0.3rem 0.55rem',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontWeight: 700,
    background:
        normalizeOrderStatus(status) === 'Completed' ? '#4ade80' :
            normalizeOrderStatus(status) === 'Shipped' ? '#3b82f6' :
                normalizeOrderStatus(status) === 'Paid' ? '#facc15' :
                    normalizeOrderStatus(status) === 'Canceled' ? '#ef4444' : '#f97316',
    color: '#081018'
});

const getInventorySyncBadgeStyle = (status) => {
    const normalized = String(status || '').trim().toLowerCase();
    const palette = {
        completed: { background: 'rgba(34,197,94,0.18)', border: '1px solid rgba(34,197,94,0.35)', color: '#86efac' },
        failed: { background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' },
        skipped_unpaid: { background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.28)', color: '#cbd5e1' },
        not_required: { background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.28)', color: '#cbd5e1' },
        not_required_lower: { background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.28)', color: '#cbd5e1' }
    };
    const key = normalized === 'not required' ? 'not_required' : normalized;
    const theme = palette[key] || { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.28)', color: '#fdba74' };
    return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.28rem 0.55rem',
        borderRadius: '999px',
        fontSize: '0.76rem',
        fontWeight: 800,
        letterSpacing: '0.03em',
        ...theme
    };
};

const getInventorySyncLabel = (status, isAr) => {
    const normalized = String(status || '').trim();
    if (!normalized) return isAr ? 'غير معروف' : 'Unknown';
    if (normalized === 'completed') return isAr ? 'تم الخصم' : 'Deducted';
    if (normalized === 'failed') return isAr ? 'فشل الخصم' : 'Failed';
    if (normalized === 'skipped_unpaid') return isAr ? 'لم يتم (غير مدفوع)' : 'Skipped (Unpaid)';
    if (normalized === 'not_required') return isAr ? 'لا حاجة' : 'Not required';
    return normalized;
};

const sectionCardStyle = {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '10px',
    overflow: 'hidden'
};

const listCellBase = {
    minWidth: 0
};

const PreviewStack = ({ layers, fallbackSrc, alt }) => (
    <div
        style={{
            position: 'relative',
            aspectRatio: '1.5',
            background: '#11141b',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)'
        }}
    >
        {Array.isArray(layers) && layers.length > 0 ? (
            layers.map((layer, idx) => (
                <img
                    key={`${layer?.src || 'layer'}-${idx}`}
                    src={layer?.src}
                    alt={idx === 0 ? alt : ''}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        opacity: layer?.opacity == null ? 1 : layer.opacity,
                        zIndex: layer?.zIndex == null ? idx : layer.zIndex,
                        pointerEvents: 'none'
                    }}
                />
            ))
        ) : (
            <img
                src={fallbackSrc || '/assets/controller.png'}
                alt={alt}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
        )}
    </div>
);

const PreviewPanel = ({ label, children }) => (
    <div style={{ display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontSize: '0.74rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
        </div>
        {children}
    </div>
);

const ItemPreview = ({ item }) => {
    if (item?.preview) {
        return (
            <PreviewPanel label="Preview">
                <div
                    style={{
                        position: 'relative',
                        aspectRatio: '1.5',
                        background: '#11141b',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}
                    dangerouslySetInnerHTML={{ __html: item.preview }}
                />
            </PreviewPanel>
        );
    }

    return (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
            <PreviewPanel label="Front">
                <PreviewStack
                    layers={item?.previewFrontLayers}
                    fallbackSrc={item?.previewFront || '/assets/controller.png'}
                    alt="Front"
                />
            </PreviewPanel>
            {(item?.previewBackLayers?.length > 0 || item?.previewBack) && (
                <PreviewPanel label="Back">
                    <PreviewStack
                        layers={item?.previewBackLayers}
                        fallbackSrc={item?.previewBack}
                        alt="Back"
                    />
                </PreviewPanel>
            )}
        </div>
    );
};

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

const DetailActionField = ({ label, value, helperText, onClick, disabled, isAr }) => {
    const align = adminAlign(isAr);
    return (
        <div style={{ display: 'grid', gap: '0.2rem', textAlign: align }}>
            <div style={{ fontSize: '0.72rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}
            </div>
            <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                style={{
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: disabled ? '#8b949e' : '#58a6ff',
                    lineHeight: 1.45,
                    textAlign: align,
                    font: 'inherit',
                    cursor: disabled ? 'not-allowed' : 'pointer'
                }}
            >
                {value || 'N/A'}
            </button>
            <div style={{ fontSize: '0.76rem', color: '#8b949e' }}>
                {helperText}
            </div>
        </div>
    );
};

async function deleteOrderDocuments(orderIds) {
    const ids = [...new Set(orderIds.map(String).filter(Boolean))];
    for (let i = 0; i < ids.length; i += FIRESTORE_BATCH_DELETE_LIMIT) {
        const chunk = ids.slice(i, i + FIRESTORE_BATCH_DELETE_LIMIT);
        const batch = writeBatch(db);
        chunk.forEach((id) => batch.delete(doc(db, 'orders', id)));
        await batch.commit();
    }
}

const AdminOrders = ({ lang = 'ar' }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailStatus, setDetailStatus] = useState('Paid');
    const [detailUrgency, setDetailUrgency] = useState('Normal');
    const [detailTrackingNumber, setDetailTrackingNumber] = useState('');
    const [whatsAppOpen, setWhatsAppOpen] = useState(false);
    const [selectedTemplateKey, setSelectedTemplateKey] = useState('controller_ready');
    const [waTemplateDefs, setWaTemplateDefs] = useState([]);
    const [waTemplatesLoading, setWaTemplatesLoading] = useState(true);
    const [waTemplatesSaving, setWaTemplatesSaving] = useState(false);
    const [waManageOpen, setWaManageOpen] = useState(false);
    const [waLocalTemplates, setWaLocalTemplates] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [urgencyFilter, setUrgencyFilter] = useState('all');
    const [saving, setSaving] = useState(false);
    const [selectedOrderIds, setSelectedOrderIds] = useState(() => new Set());
    const [deletingOrders, setDeletingOrders] = useState(false);
    const selectAllCheckboxRef = useRef(null);

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

    const getStatusLabelText = (status) => {
        const normalized = normalizeOrderStatus(status);
        if (normalized === 'Paid') return isAr ? 'مدفوع' : 'Paid';
        if (normalized === 'On Going') return isAr ? 'قيد التنفيذ' : 'On Going';
        if (normalized === 'Completed') return isAr ? 'مكتمل' : 'Completed';
        if (normalized === 'Shipped') return isAr ? 'تم الشحن' : 'Shipped';
        if (normalized === 'Canceled') return isAr ? 'ملغي' : 'Canceled';
        return status;
    };

    const getUrgencyLabelText = (urgency) => {
        const normalized = normalizeOrderUrgency(urgency);
        if (normalized === 'Very Urgent') return isAr ? 'عاجل جداً' : 'Very Urgent';
        if (normalized === 'Urgent') return isAr ? 'عاجل' : 'Urgent';
        return isAr ? 'عادي' : 'Normal';
    };

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const ordersList = querySnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
            setOrders(ordersList);
            setSelectedOrderId((current) => (
                ordersList.some((order) => order.id === current) ? current : ''
            ));
        } catch (error) {
            console.error('Error fetching orders: ', error);
            if (error.message.includes('index')) {
                const querySnapshot = await getDocs(collection(db, 'orders'));
                const ordersList = querySnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
                setOrders(ordersList);
                setSelectedOrderId((current) => (
                    ordersList.some((order) => order.id === current) ? current : ''
                ));
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setWaTemplatesLoading(true);
                const list = await loadWhatsAppTemplates(db);
                if (cancelled) return;
                setWaTemplateDefs(list);
                setSelectedTemplateKey((prev) => {
                    if (list.some((t) => t.id === prev)) return prev;
                    const preferred = list.find((t) => t.id === 'controller_ready');
                    return (preferred || list[0])?.id || prev;
                });
            } catch (error) {
                console.error('Failed to load WhatsApp templates', error);
                if (!cancelled) {
                    alert(isAr ? 'تعذر تحميل قوالب واتساب' : 'Failed to load WhatsApp templates');
                }
            } finally {
                if (!cancelled) setWaTemplatesLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isAr]);

    const selectedOrder = useMemo(
        () => orders.find((order) => order.id === selectedOrderId) || null,
        [orders, selectedOrderId]
    );

    const paymentStatusOptions = useMemo(() => {
        const values = new Set(['Paid', 'Pending', 'Failed']);
        orders.forEach((order) => {
            const paymentStatus = String(getPaymentStatus(order) || '').trim();
            if (paymentStatus) values.add(paymentStatus);
        });
        return Array.from(values);
    }, [orders]);

    const filteredOrders = useMemo(() => {
        const queryValue = searchTerm.trim().toLowerCase();
        return orders.filter((order) => {
            const normalizedStatus = normalizeOrderStatus(order.status, order);
            const normalizedUrgency = normalizeOrderUrgency(order.urgency);
            const normalizedPaymentStatus = String(getPaymentStatus(order) || 'Pending').trim();

            if (statusFilter !== 'all' && normalizedStatus !== statusFilter) return false;
            if (paymentFilter !== 'all' && normalizedPaymentStatus !== paymentFilter) return false;
            if (urgencyFilter !== 'all' && normalizedUrgency !== urgencyFilter) return false;
            if (!queryValue) return true;

            const searchableText = [
                getOrderNumberLabel(order),
                getCustomerName(order),
                order.customer?.email,
                order.customer?.phone,
                getPaymentReference(order),
                getTrackingNumber(order),
                normalizedStatus,
                normalizedUrgency,
                normalizedPaymentStatus
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchableText.includes(queryValue);
        });
    }, [orders, paymentFilter, searchTerm, statusFilter, urgencyFilter]);

    const filteredOrderIds = useMemo(() => filteredOrders.map((o) => o.id), [filteredOrders]);
    const allFilteredSelected = filteredOrderIds.length > 0 && filteredOrderIds.every((id) => selectedOrderIds.has(id));
    const someFilteredSelected = filteredOrderIds.some((id) => selectedOrderIds.has(id)) && !allFilteredSelected;

    useEffect(() => {
        const el = selectAllCheckboxRef.current;
        if (el) el.indeterminate = someFilteredSelected;
    }, [someFilteredSelected]);

    const customerPhoneDigits = useMemo(
        () => normalizeWhatsAppPhone(selectedOrder?.customer?.phone),
        [selectedOrder]
    );

    const waTemplateContext = useMemo(
        () => buildWhatsAppTemplateContext(
            selectedOrder,
            detailTrackingNumber.trim(),
            typeof window !== 'undefined' ? window.location.origin : ''
        ),
        [detailTrackingNumber, selectedOrder]
    );

    const whatsAppTemplates = useMemo(() => {
        if (!waTemplateContext) return [];
        return waTemplateDefs.map((def) => ({
            key: def.id,
            label: def.label,
            message: applyWhatsAppTemplateBody(def.body, waTemplateContext)
        }));
    }, [waTemplateContext, waTemplateDefs]);

    const selectedWhatsAppTemplate = useMemo(() => {
        if (!whatsAppTemplates.length) return null;
        return whatsAppTemplates.find((template) => template.key === selectedTemplateKey) || whatsAppTemplates[0];
    }, [selectedTemplateKey, whatsAppTemplates]);

    const previewLinks = useMemo(
        () => getFirstPreviewLinks(selectedOrder, typeof window !== 'undefined' ? window.location.origin : ''),
        [selectedOrder]
    );

    const hasOrderChanges = selectedOrder
        ? detailStatus !== normalizeOrderStatus(selectedOrder.status, selectedOrder) ||
        detailUrgency !== normalizeOrderUrgency(selectedOrder.urgency) ||
        detailTrackingNumber.trim() !== getTrackingNumber(selectedOrder).trim()
        : false;

    useEffect(() => {
        setDetailStatus(normalizeOrderStatus(selectedOrder?.status, selectedOrder));
        setDetailUrgency(normalizeOrderUrgency(selectedOrder?.urgency));
        setDetailTrackingNumber(getTrackingNumber(selectedOrder));
        setWhatsAppOpen(false);
        setSelectedTemplateKey('controller_ready');
    }, [selectedOrder]);

    useEffect(() => {
        if (!detailOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            if (whatsAppOpen) {
                setWhatsAppOpen(false);
                return;
            }
            setDetailOpen(false);
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [detailOpen, whatsAppOpen]);

    const openOrderDetails = (orderId) => {
        setSelectedOrderId(orderId);
        setDetailOpen(true);
    };

    const closeOrderDetails = () => {
        setWhatsAppOpen(false);
        setDetailOpen(false);
    };

    const handleStatusSave = async () => {
        if (!selectedOrder || saving || !hasOrderChanges) return;

        setSaving(true);
        try {
            const trackingNumber = detailTrackingNumber.trim();
            const updatedAt = new Date();
            await updateDoc(doc(db, 'orders', selectedOrder.id), {
                status: detailStatus,
                urgency: detailUrgency,
                'shipping.trackingNumber': trackingNumber,
                updatedAt
            });

            setOrders((current) => current.map((order) => (
                order.id === selectedOrder.id
                    ? {
                        ...order,
                        status: detailStatus,
                        urgency: detailUrgency,
                        updatedAt,
                        shipping: {
                            ...(order.shipping || {}),
                            trackingNumber
                        }
                    }
                    : order
            )));
        } catch (error) {
            console.error('Error updating status', error);
            alert('Failed to update status');
        } finally {
            setSaving(false);
        }
    };

    const openWhatsAppModal = () => {
        if (!customerPhoneDigits) {
            alert('Customer phone number is missing or invalid.');
            return;
        }
        setWhatsAppOpen(true);
    };

    const closeWhatsAppModal = () => {
        setWhatsAppOpen(false);
        setWaManageOpen(false);
    };

    const openWaTemplateManage = () => {
        setWaLocalTemplates(waTemplateDefs.map((t) => ({ ...t })));
        setWaManageOpen(true);
    };

    const cancelWaTemplateManage = () => {
        setWaManageOpen(false);
    };

    const patchWaLocalRow = (id, field, value) => {
        setWaLocalTemplates((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    };

    const addWaLocalTemplate = () => {
        setWaLocalTemplates((rows) => [
            ...rows,
            {
                id: `tpl_${Date.now()}`,
                label: isAr ? 'قالب جديد' : 'New template',
                body: 'Hello {{customerName}},\n\n'
            }
        ]);
    };

    const removeWaLocalRow = (id) => {
        if (waLocalTemplates.length <= 1) {
            alert(isAr ? 'يجب الإبقاء على قالب واحد على الأقل.' : 'You must keep at least one template.');
            return;
        }
        const ok = window.confirm(
            isAr ? 'حذف هذا القالب؟' : 'Delete this template?'
        );
        if (!ok) return;
        setWaLocalTemplates((rows) => rows.filter((r) => r.id !== id));
    };

    const saveWaTemplatesFromManage = async () => {
        if (!waLocalTemplates.length) {
            alert(isAr ? 'أضف قالبًا واحدًا على الأقل.' : 'Add at least one template.');
            return;
        }
        const invalid = waLocalTemplates.some((r) => !String(r.label || '').trim());
        if (invalid) {
            alert(isAr ? 'كل قالب يحتاج عنوانًا.' : 'Each template needs a title.');
            return;
        }
        setWaTemplatesSaving(true);
        try {
            const saved = await saveWhatsAppTemplates(db, waLocalTemplates);
            setWaTemplateDefs(saved);
            setSelectedTemplateKey((prev) => (saved.some((t) => t.id === prev) ? prev : saved[0].id));
            setWaManageOpen(false);
        } catch (error) {
            console.error('Failed to save WhatsApp templates', error);
            alert(isAr ? 'فشل حفظ القوالب.' : 'Failed to save templates.');
        } finally {
            setWaTemplatesSaving(false);
        }
    };

    useEffect(() => {
        if (!waTemplateDefs.length) return;
        setSelectedTemplateKey((prev) => (
            waTemplateDefs.some((t) => t.id === prev)
                ? prev
                : (waTemplateDefs.find((t) => t.id === 'controller_ready') || waTemplateDefs[0]).id
        ));
    }, [waTemplateDefs]);

    const handleSendWhatsApp = () => {
        if (!customerPhoneDigits || !selectedWhatsAppTemplate?.message) {
            alert('WhatsApp message is not ready.');
            return;
        }

        const href = `https://wa.me/${customerPhoneDigits}?text=${encodeURIComponent(selectedWhatsAppTemplate.message)}`;
        window.open(href, '_blank', 'noopener,noreferrer');
    };

    const handleResetFilters = () => {
        setSearchTerm('');
        setStatusFilter('all');
        setPaymentFilter('all');
        setUrgencyFilter('all');
    };

    const toggleOrderSelected = (orderId) => {
        setSelectedOrderIds((prev) => {
            const next = new Set(prev);
            if (next.has(orderId)) next.delete(orderId);
            else next.add(orderId);
            return next;
        });
    };

    const handleSelectAllFilteredChange = () => {
        setSelectedOrderIds((prev) => {
            const next = new Set(prev);
            const fids = filteredOrderIds;
            const allSel = fids.length > 0 && fids.every((id) => next.has(id));
            if (allSel) {
                fids.forEach((id) => next.delete(id));
            } else {
                fids.forEach((id) => next.add(id));
            }
            return next;
        });
    };

    const clearOrderSelection = () => setSelectedOrderIds(new Set());

    const removeOrdersFromState = (ids) => {
        const idSet = new Set(ids);
        setOrders((current) => current.filter((o) => !idSet.has(o.id)));
        setSelectedOrderIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.delete(id));
            return next;
        });
        if (idSet.has(selectedOrderId)) {
            setSelectedOrderId('');
            setDetailOpen(false);
            setWhatsAppOpen(false);
        }
    };

    const handleBulkDeleteOrders = async () => {
        const ids = Array.from(selectedOrderIds).filter((id) => orders.some((o) => o.id === id));
        if (!ids.length) return;
        const confirmMsg = isAr
            ? `حذف ${ids.length} طلب(ات) نهائياً؟ لا يمكن التراجع. سيتم استرجاع المخزون تلقائياً إن وُجد خصم سابق.`
            : `Permanently delete ${ids.length} order(s)? This cannot be undone. Inventory will be restored automatically for orders that had stock deducted.`;
        if (!window.confirm(confirmMsg)) return;
        setDeletingOrders(true);
        try {
            await deleteOrderDocuments(ids);
            removeOrdersFromState(ids);
        } catch (err) {
            console.error(err);
            alert(isAr ? `فشل الحذف: ${err.message}` : `Delete failed: ${err.message}`);
        } finally {
            setDeletingOrders(false);
        }
    };

    const handleSingleDeleteOrder = async () => {
        if (!selectedOrder || deletingOrders) return;
        const id = selectedOrder.id;
        const confirmMsg = isAr
            ? `حذف الطلب ${getOrderNumberLabel(selectedOrder)} نهائياً؟ سيتم استرجاع المخزون إن وُجد خصم.`
            : `Permanently delete order ${getOrderNumberLabel(selectedOrder)}? Inventory will be restored if stock was deducted.`;
        if (!window.confirm(confirmMsg)) return;
        setDeletingOrders(true);
        try {
            await deleteDoc(doc(db, 'orders', id));
            removeOrdersFromState([id]);
        } catch (err) {
            console.error(err);
            alert(isAr ? `فشل الحذف: ${err.message}` : `Delete failed: ${err.message}`);
        } finally {
            setDeletingOrders(false);
        }
    };

    if (loading) return <LoadingState message={isAr ? "جاري تحميل الطلبات..." : "Loading orders..."} minHeight="32vh" />;

    if (orders.length === 0) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#8b949e' }}>
                <p>{isAr ? "لم يتم العثور على طلبات في النظام." : "No orders found in Firebase."}</p>
            </div>
        );
    }

    return (
        <div>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(220px, 1.6fr) repeat(3, minmax(160px, 0.8fr)) auto',
                    gap: '0.75rem',
                    alignItems: 'end',
                    marginBottom: '1rem'
                }}
            >
                <div style={{ display: 'grid', gap: '0.35rem', textAlign: adminAlign(isAr) }}>
                    <div style={{ fontSize: '0.74rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {isAr ? "بحث" : "Search"}
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder={isAr ? "بحث برقم الطلب، العميل، الهاتف، التتبع..." : "Search by order, customer, phone, tracking, payment ref"}
                        style={{
                            padding: '0.72rem 0.8rem',
                            borderRadius: '8px',
                            border: '1px solid #30363d',
                            background: '#0d1117',
                            color: '#e6edf3'
                        }}
                    />
                </div>

                <div style={{ display: 'grid', gap: '0.35rem', textAlign: adminAlign(isAr) }}>
                    <div style={{ fontSize: '0.74rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {isAr ? "الحالة" : "Status"}
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        style={{
                            padding: '0.72rem 0.8rem',
                            borderRadius: '8px',
                            border: '1px solid #30363d',
                            background: '#0d1117',
                            color: '#e6edf3'
                        }}
                    >
                        <option value="all">{isAr ? "جميع الحالات" : "All Statuses"}</option>
                        {ORDER_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{getStatusLabelText(status)}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'grid', gap: '0.35rem', textAlign: adminAlign(isAr) }}>
                    <div style={{ fontSize: '0.74rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {isAr ? "الدفع" : "Payment"}
                    </div>
                    <select
                        value={paymentFilter}
                        onChange={(event) => setPaymentFilter(event.target.value)}
                        style={{
                            padding: '0.72rem 0.8rem',
                            borderRadius: '8px',
                            border: '1px solid #30363d',
                            background: '#0d1117',
                            color: '#e6edf3'
                        }}
                    >
                        <option value="all">{isAr ? "جميع المدفوعات" : "All Payments"}</option>
                        {paymentStatusOptions.map((status) => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'grid', gap: '0.35rem', textAlign: adminAlign(isAr) }}>
                    <div style={{ fontSize: '0.74rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {isAr ? "الأهمية" : "Urgency"}
                    </div>
                    <select
                        value={urgencyFilter}
                        onChange={(event) => setUrgencyFilter(event.target.value)}
                        style={{
                            padding: '0.72rem 0.8rem',
                            borderRadius: '8px',
                            border: '1px solid #30363d',
                            background: '#0d1117',
                            color: '#e6edf3'
                        }}
                    >
                        <option value="all">{isAr ? "جميع الأهميات" : "All Urgency"}</option>
                        {ORDER_URGENCY_OPTIONS.map((urgency) => (
                            <option key={urgency} value={urgency}>{getUrgencyLabelText(urgency)}</option>
                        ))}
                    </select>
                </div>

                <button
                    type="button"
                    onClick={handleResetFilters}
                    style={{
                        padding: '0.72rem 0.95rem',
                        borderRadius: '8px',
                        border: '1px solid #3b4452',
                        background: '#111827',
                        color: '#e6edf3',
                        cursor: 'pointer'
                    }}
                >
                    {isAr ? "إعادة ضبط" : "Reset"}
                </button>
            </div>

            {selectedOrderIds.size > 0 && (
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        alignItems: 'center',
                        marginBottom: '0.75rem',
                        padding: '0.75rem 1rem',
                        background: '#161b22',
                        border: '1px solid #30363d',
                        borderRadius: '10px'
                    }}
                >
                    <span style={{ color: '#e6edf3', fontWeight: 600 }}>
                        {isAr ? `${selectedOrderIds.size} طلب محدد` : `${selectedOrderIds.size} order(s) selected`}
                    </span>
                    <button
                        type="button"
                        onClick={handleBulkDeleteOrders}
                        disabled={deletingOrders}
                        style={{
                            padding: '0.55rem 0.95rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(239,68,68,0.45)',
                            background: deletingOrders ? '#1f2937' : 'rgba(127,29,29,0.35)',
                            color: '#fecaca',
                            fontWeight: 700,
                            cursor: deletingOrders ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {deletingOrders
                            ? (isAr ? 'جاري الحذف...' : 'Deleting...')
                            : (isAr ? 'حذف المحدد' : 'Delete selected')}
                    </button>
                    <button
                        type="button"
                        onClick={clearOrderSelection}
                        disabled={deletingOrders}
                        style={{
                            padding: '0.55rem 0.85rem',
                            borderRadius: '8px',
                            border: '1px solid #3b4452',
                            background: '#0d1117',
                            color: '#e6edf3',
                            cursor: deletingOrders ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isAr ? 'إلغاء التحديد' : 'Clear selection'}
                    </button>
                </div>
            )}

            <section style={sectionCardStyle}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'stretch',
                        borderBottom: '1px solid #30363d',
                        background: '#0d1117'
                    }}
                >
                    <div
                        style={{
                            flex: `0 0 ${CHECKBOX_COL_WIDTH}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0.5rem'
                        }}
                    >
                        <input
                            ref={selectAllCheckboxRef}
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={handleSelectAllFilteredChange}
                            disabled={deletingOrders || filteredOrders.length === 0}
                            title={isAr ? 'تحديد الكل في القائمة الحالية' : 'Select all in current list'}
                            aria-label={isAr ? 'تحديد الكل' : 'Select all'}
                        />
                    </div>
                    <div
                        style={{
                            flex: 1,
                            display: 'grid',
                            gridTemplateColumns: LIST_COLUMNS,
                            gap: '0.75rem',
                            padding: '0.85rem 1rem',
                            fontSize: '0.72rem',
                            color: '#8b949e',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}
                    >
                        <div style={listCellStyle}>{isAr ? "الطلب" : "Order"}</div>
                        <div style={listCellStyle}>{isAr ? "العميل" : "Customer"}</div>
                        <div style={listCellStyle}>{isAr ? "الإجمالي" : "Total"}</div>
                        <div style={listCellStyle}>{isAr ? "الدفع" : "Payment"}</div>
                        <div style={listCellStyle}>{isAr ? "الأهمية" : "Urgency"}</div>
                        <div style={listCellStyle}>{isAr ? "الحالة" : "Status"}</div>
                    </div>
                </div>

                <div style={{ display: 'grid' }}>
                    {filteredOrders.map((order) => {
                        const isSelected = detailOpen && order.id === selectedOrderId;
                        return (
                            <div
                                key={order.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'stretch',
                                    borderTop: '1px solid rgba(255,255,255,0.05)',
                                    background: isSelected ? '#1f2937' : 'transparent'
                                }}
                            >
                                <div
                                    style={{
                                        flex: `0 0 ${CHECKBOX_COL_WIDTH}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedOrderIds.has(order.id)}
                                        onChange={() => toggleOrderSelected(order.id)}
                                        disabled={deletingOrders}
                                        onClick={(e) => e.stopPropagation()}
                                        aria-label={isAr ? 'تحديد الطلب' : 'Select order'}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => openOrderDetails(order.id)}
                                    disabled={deletingOrders}
                                    style={{
                                        flex: 1,
                                        display: 'grid',
                                        gridTemplateColumns: LIST_COLUMNS,
                                        gap: '0.75rem',
                                        padding: '1rem',
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#e6edf3',
                                        textAlign: adminAlign(isAr),
                                        cursor: deletingOrders ? 'not-allowed' : 'pointer',
                                        opacity: deletingOrders ? 0.65 : 1
                                    }}
                                >
                                    <div style={listCellStyle}>
                                        <div style={{ fontFamily: 'Consolas, monospace', fontSize: '0.82rem' }}>
                                            {getOrderNumberLabel(order)}
                                        </div>
                                        <div style={{ fontSize: '0.76rem', color: '#8b949e', marginTop: '0.2rem' }}>
                                            {formatDate(order.createdAt)}
                                        </div>
                                    </div>

                                    <div style={listCellStyle}>
                                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {getCustomerName(order)}
                                        </div>
                                        <div style={{ fontSize: '0.76rem', color: '#8b949e', marginTop: '0.2rem' }}>
                                            {(order.items || []).length} {isAr ? "عنصر" : "item(s)"}
                                        </div>
                                    </div>

                                    <div style={{ ...listCellStyle, fontWeight: 700 }}>
                                        {Number(order.total || 0).toFixed(2)} {order.currency || 'BHD'}
                                    </div>

                                    <div style={listCellStyle}>
                                        <div>{getPaymentMethod(order)}</div>
                                        <div style={{ fontSize: '0.76rem', color: '#8b949e', marginTop: '0.2rem' }}>
                                            {getPaymentStatus(order)}
                                        </div>
                                    </div>

                                    <div style={listCellStyle}>
                                        <span style={getUrgencyBadgeStyle(order.urgency)}>
                                            {getUrgencyLabelText(order.urgency)}
                                        </span>
                                    </div>

                                    <div style={listCellStyle}>
                                        <span style={getStatusBadgeStyle(order.status || 'Paid')}>
                                            {getStatusLabelText(order.status)}
                                        </span>
                                    </div>
                                </button>
                            </div>
                        );
                    })}

                    {filteredOrders.length === 0 && (
                        <div
                            style={{
                                padding: '1.25rem 1rem',
                                color: '#8b949e',
                                borderTop: '1px solid rgba(255,255,255,0.05)'
                            }}
                        >
                            {isAr ? "لا توجد طلبات تطابق الفلتر الحالي." : "No orders match the current filters."}
                        </div>
                    )}
                </div>
            </section>

            {detailOpen && selectedOrder && (
                <div
                    onClick={closeOrderDetails}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(3, 7, 18, 0.78)',
                        backdropFilter: 'blur(6px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem',
                        zIndex: 1200
                    }}
                >
                    <div
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            width: 'min(1180px, 100%)',
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
                                alignItems: 'center',
                                gap: '1rem',
                                flexWrap: 'wrap',
                                padding: '1.25rem 1.5rem',
                                borderBottom: '1px solid #30363d',
                                background: '#161b22'
                            }}
                        >
                            <div style={{ textAlign: adminAlign(isAr) }}>
                                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e6edf3' }}>
                                    {isAr ? "تفاصيل الطلب" : "Order Details"}
                                </div>
                                <div style={{ marginTop: '0.3rem', fontFamily: 'Consolas, monospace', color: '#8b949e' }}>
                                    {getOrderNumberLabel(selectedOrder)}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={getStatusBadgeStyle(selectedOrder.status || 'Paid')}>
                                    {getStatusLabelText(selectedOrder.status)}
                                </span>
                                <button
                                    type="button"
                                    onClick={fetchOrders}
                                    disabled={deletingOrders}
                                    style={{
                                        padding: '0.55rem 0.8rem',
                                        borderRadius: '6px',
                                        border: '1px solid #3b4452',
                                        background: '#0d1117',
                                        color: '#e6edf3',
                                        cursor: deletingOrders ? 'not-allowed' : 'pointer',
                                        opacity: deletingOrders ? 0.6 : 1
                                    }}
                                >
                                    {isAr ? "تحديث" : "Refresh"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSingleDeleteOrder}
                                    disabled={deletingOrders}
                                    style={{
                                        padding: '0.55rem 0.8rem',
                                        borderRadius: '6px',
                                        border: '1px solid rgba(239,68,68,0.45)',
                                        background: 'rgba(127,29,29,0.25)',
                                        color: '#fecaca',
                                        fontWeight: 700,
                                        cursor: deletingOrders ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {deletingOrders ? (isAr ? 'جاري الحذف...' : 'Deleting...') : (isAr ? 'حذف الطلب' : 'Delete order')}
                                </button>
                                <button
                                    type="button"
                                    onClick={closeOrderDetails}
                                    disabled={deletingOrders}
                                    style={{
                                        padding: '0.55rem 0.8rem',
                                        borderRadius: '6px',
                                        border: '1px solid #3b4452',
                                        background: '#0d1117',
                                        color: '#e6edf3',
                                        cursor: deletingOrders ? 'not-allowed' : 'pointer',
                                        opacity: deletingOrders ? 0.6 : 1
                                    }}
                                >
                                    {isAr ? "إغلاق" : "Close"}
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem', padding: '1.25rem 1.5rem', textAlign: adminAlign(isAr) }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem', textAlign: adminAlign(isAr) }}>
                                    <DetailField isAr={isAr} label={isAr ? "العميل" : "Customer"} value={getCustomerName(selectedOrder)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField isAr={isAr} label={isAr ? "البريد الإلكتروني" : "Email"} value={selectedOrder.customer?.email} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailActionField
                                        label={isAr ? "الهاتف" : "Phone"}
                                        value={selectedOrder.customer?.phone}
                                        helperText={isAr ? "انقر لاختيار قالب واتساب وإرساله." : "Click to choose a WhatsApp template and send it."}
                                        onClick={openWhatsAppModal}
                                        disabled={!customerPhoneDigits}
                                        isAr={isAr}
                                    />
                                </div>

                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem', textAlign: adminAlign(isAr) }}>
                                    <DetailField isAr={isAr} label={isAr ? "طريقة الشحن" : "Shipping Method"} value={selectedOrder.shipping?.method} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField isAr={isAr} label={isAr ? "العنوان" : "Address"} value={formatAddress(selectedOrder.shipping)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField isAr={isAr} label={isAr ? "رقم الشحنة" : "Shipping Number"} value={getTrackingNumber(selectedOrder)} />
                                </div>

                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem', textAlign: adminAlign(isAr) }}>
                                    <DetailField isAr={isAr} label={isAr ? "طريقة الدفع" : "Payment Method"} value={getPaymentMethod(selectedOrder)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField isAr={isAr} label={isAr ? "حالة الدفع" : "Payment Status"} value={getPaymentStatus(selectedOrder)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField isAr={isAr} label={isAr ? "المرجع" : "Reference"} value={getPaymentReference(selectedOrder)} />
                                </div>

                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem', textAlign: adminAlign(isAr) }}>
                                    <DetailField isAr={isAr} label={isAr ? "أنشئ في" : "Created"} value={formatDate(selectedOrder.createdAt)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField
                                        isAr={isAr}
                                        label={isAr ? "الإجمالي" : "Total"}
                                        value={`${Number(selectedOrder.total || 0).toFixed(2)} ${selectedOrder.currency || 'BHD'}`}
                                    />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField
                                        isAr={isAr}
                                        label={isAr ? "العناصر" : "Items"}
                                        value={`${(selectedOrder.items || []).length} ${isAr ? "عنصر" : "item(s)"}`}
                                    />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField
                                        isAr={isAr}
                                        label={isAr ? "الأهمية" : "Urgency"}
                                        value={getUrgencyLabelText(selectedOrder.urgency)}
                                    />
                                </div>
                            </div>

                            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <div style={{ fontWeight: 800, color: '#e6edf3' }}>
                                        {isAr ? 'المخزون (خصم العناصر)' : 'Inventory (Stock Deduction)'}
                                    </div>
                                    <span style={getInventorySyncBadgeStyle(getInventorySyncStatus(selectedOrder))}>
                                        {getInventorySyncLabel(getInventorySyncStatus(selectedOrder), isAr)}
                                    </span>
                                </div>

                                <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.75rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
                                        <div style={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.9rem' }}>
                                            <DetailField
                                                isAr={isAr}
                                                label={isAr ? 'حالة المزامنة' : 'Sync Status'}
                                                value={getInventorySyncStatus(selectedOrder) || (isAr ? 'غير متوفر' : 'N/A')}
                                            />
                                            <div style={{ height: '0.6rem' }} />
                                            <DetailField
                                                isAr={isAr}
                                                label={isAr ? 'عدد الحركات' : 'Adjustments'}
                                                value={String(getInventoryAdjustments(selectedOrder).length)}
                                            />
                                        </div>
                                        <div style={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.9rem' }}>
                                            <DetailField
                                                isAr={isAr}
                                                label={isAr ? 'ملاحظة / خطأ' : 'Note / Error'}
                                                value={getInventorySyncError(selectedOrder) || (isAr ? 'لا يوجد' : 'None')}
                                            />
                                        </div>
                                    </div>

                                    {getInventoryAdjustments(selectedOrder).length > 0 && (
                                        <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
                                            <div
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'minmax(220px, 2.2fr) 0.7fr 0.7fr 0.9fr',
                                                    gap: '0.75rem',
                                                    padding: '0.75rem 0.9rem',
                                                    background: '#0b1220',
                                                    color: '#8b949e',
                                                    fontSize: '0.72rem',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.08em',
                                                    textAlign: adminAlign(isAr)
                                                }}
                                            >
                                                <div>{isAr ? 'المسار / الصنف' : 'Path / Item'}</div>
                                                <div>{isAr ? 'الطلب' : 'Requested'}</div>
                                                <div>{isAr ? 'الخصم' : 'Deducted'}</div>
                                                <div>{isAr ? 'المتبقي' : 'Remaining'}</div>
                                            </div>
                                            <div style={{ display: 'grid' }}>
                                                {getInventoryAdjustments(selectedOrder).map((row, idx) => (
                                                    <div
                                                        key={`${row?.path || 'inv'}-${idx}`}
                                                        style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: 'minmax(220px, 2.2fr) 0.7fr 0.7fr 0.9fr',
                                                            gap: '0.75rem',
                                                            padding: '0.8rem 0.9rem',
                                                            borderTop: '1px solid rgba(255,255,255,0.06)',
                                                            background: 'transparent',
                                                            color: '#e6edf3',
                                                            fontFamily: 'inherit',
                                                            textAlign: adminAlign(isAr)
                                                        }}
                                                    >
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontFamily: 'Consolas, monospace', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {row?.path || 'N/A'}
                                                            </div>
                                                            <div style={{ fontSize: '0.76rem', color: '#8b949e', marginTop: '0.2rem' }}>
                                                                {row?.sourceType || ''}
                                                            </div>
                                                        </div>
                                                        <div style={{ fontFamily: 'Consolas, monospace' }}>{String(row?.quantity ?? '')}</div>
                                                        <div style={{ fontFamily: 'Consolas, monospace', color: Number(row?.deducted || 0) > 0 ? '#86efac' : '#cbd5e1' }}>
                                                            {String(row?.deducted ?? '')}
                                                        </div>
                                                        <div style={{ fontFamily: 'Consolas, monospace' }}>{String(row?.remaining ?? '')}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {getInventoryAdjustments(selectedOrder).length === 0 && (
                                        <div style={{ color: '#8b949e' }}>
                                            {isAr
                                                ? 'لا توجد حركات مخزون مسجلة لهذا الطلب.'
                                                : 'No inventory movements recorded for this order.'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#e6edf3' }}>{isAr ? "تحديث الحالة" : "Update Status"}</div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <select
                                            value={detailStatus}
                                            onChange={(event) => setDetailStatus(event.target.value)}
                                            style={{
                                                minWidth: '180px',
                                                padding: '0.6rem 0.7rem',
                                                borderRadius: '6px',
                                                border: '1px solid #3b4452',
                                                background: '#111827',
                                                color: '#e6edf3'
                                            }}
                                        >
                                            {ORDER_STATUS_OPTIONS.map((status) => (
                                                <option key={status} value={status}>{getStatusLabelText(status)}</option>
                                            ))}
                                        </select>

                                        <select
                                            value={detailUrgency}
                                            onChange={(event) => setDetailUrgency(event.target.value)}
                                            style={{
                                                minWidth: '170px',
                                                padding: '0.6rem 0.7rem',
                                                borderRadius: '6px',
                                                border: '1px solid #3b4452',
                                                background: '#111827',
                                                color: '#e6edf3'
                                            }}
                                        >
                                            {ORDER_URGENCY_OPTIONS.map((urgency) => (
                                                <option key={urgency} value={urgency}>{getUrgencyLabelText(urgency)}</option>
                                            ))}
                                        </select>

                                        <input
                                            type="text"
                                            value={detailTrackingNumber}
                                            onChange={(event) => setDetailTrackingNumber(event.target.value)}
                                            placeholder={t('admin.orders.tracking')}
                                            style={{
                                                minWidth: '220px',
                                                padding: '0.6rem 0.7rem',
                                                borderRadius: '6px',
                                                border: '1px solid #3b4452',
                                                background: '#111827',
                                                color: '#e6edf3'
                                            }}
                                        />

                                        <button
                                            type="button"
                                            onClick={handleStatusSave}
                                            disabled={saving || !hasOrderChanges}
                                            style={{
                                                padding: '0.62rem 1rem',
                                                borderRadius: '6px',
                                                border: 'none',
                                                background: '#238636',
                                                color: '#fff',
                                                fontWeight: 700,
                                                cursor: saving ? 'not-allowed' : 'pointer',
                                                opacity: saving || !hasOrderChanges ? 0.6 : 1
                                            }}
                                        >
                                            {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gap: '0.9rem' }}>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e6edf3' }}>{isAr ? "عناصر الطلب" : "Order Items"}</div>

                                {(selectedOrder.items || []).map((item, idx) => (
                                    <div
                                        key={`${selectedOrder.id}-${idx}`}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'minmax(240px, 280px) minmax(0, 1fr)',
                                            gap: '1rem',
                                            background: '#0d1117',
                                            border: '1px solid #30363d',
                                            borderRadius: '10px',
                                            padding: '1rem'
                                        }}
                                    >
                                        <ItemPreview item={item} />

                                        <div style={{ display: 'grid', gap: '0.55rem', color: '#d6d9e0' }}>
                                            <div style={{ fontSize: '1rem', fontWeight: 700 }}>
                                                {item.name || 'Controller'}
                                            </div>
                                            <DetailField isAr={isAr} label={isAr ? "الكمية" : "Quantity"} value={String(item.quantity || 1)} />
                                            <DetailField isAr={isAr} label={isAr ? "مجموع السطر" : "Line Total"} value={`${getItemLineTotal(item).toFixed(2)} BHD`} />
                                            <ItemCustomizationSummary item={item} lang={lang} compact />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {detailOpen && selectedOrder && whatsAppOpen && (
                <div
                    onClick={closeWhatsAppModal}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(3, 7, 18, 0.72)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1.5rem',
                        zIndex: 1250
                    }}
                >
                    <div
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            width: 'min(760px, 100%)',
                            maxHeight: '88vh',
                            overflowY: 'auto',
                            background: '#161b22',
                            border: '1px solid #30363d',
                            borderRadius: '14px',
                            boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
                            padding: '1.25rem'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e6edf3' }}>
                                    {isAr ? "رسالة واتساب" : "WhatsApp Message"}
                                </div>
                                <div style={{ fontSize: '0.84rem', color: '#8b949e', marginTop: '0.25rem' }}>
                                    {selectedOrder.customer?.phone || 'N/A'}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={closeWhatsAppModal}
                                style={{
                                    padding: '0.55rem 0.8rem',
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

                        <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                            {waTemplatesLoading && (
                                <div style={{ color: '#8b949e', fontSize: '0.9rem' }}>
                                    {isAr ? 'جاري تحميل القوالب…' : 'Loading templates…'}
                                </div>
                            )}

                            {!waTemplatesLoading && whatsAppTemplates.length === 0 && (
                                <div style={{ color: '#f85149', fontSize: '0.9rem' }}>
                                    {isAr ? 'لا توجد قوالب. افتح إدارة القوالب لإضافة قالب.' : 'No templates. Use Manage templates to add one.'}
                                </div>
                            )}

                            {!waTemplatesLoading && whatsAppTemplates.length > 0 && (
                                <label style={{ display: 'grid', gap: '0.35rem' }}>
                                    <span
                                        style={{
                                            fontSize: '0.72rem',
                                            color: '#8b949e',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.06em',
                                            textAlign: adminAlign(isAr)
                                        }}
                                    >
                                        {isAr ? 'اختر القالب' : 'Template'}
                                    </span>
                                    <select
                                        value={selectedWhatsAppTemplate?.key || ''}
                                        onChange={(e) => setSelectedTemplateKey(e.target.value)}
                                        style={{
                                            padding: '0.65rem 0.75rem',
                                            borderRadius: '8px',
                                            border: '1px solid #30363d',
                                            background: '#0d1117',
                                            color: '#e6edf3',
                                            fontSize: '0.95rem',
                                            textAlign: adminAlign(isAr)
                                        }}
                                    >
                                        {whatsAppTemplates.map((template) => (
                                            <option key={template.key} value={template.key}>
                                                {template.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}

                            <div
                                style={{
                                    background: '#0d1117',
                                    border: '1px solid #30363d',
                                    borderRadius: '8px',
                                    padding: '0.85rem',
                                    textAlign: adminAlign(isAr)
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: '0.72rem',
                                        color: '#8b949e',
                                        marginBottom: '0.55rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.06em'
                                    }}
                                >
                                    {isAr ? 'وسوم للاستخدام في نص القالب' : 'Placeholders for template text'}
                                </div>
                                <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.82rem' }}>
                                    {WHATSAPP_TEMPLATE_TAGS.map((row) => (
                                        <div key={row.tag} style={{ color: '#c9d1d9', lineHeight: 1.45 }}>
                                            <code style={{ color: '#79c0ff', fontSize: '0.8rem' }}>{row.tag}</code>
                                            <span style={{ color: '#8b949e', marginInlineStart: '0.45rem' }}>
                                                {isAr ? row.ar : row.en}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    onClick={openWaTemplateManage}
                                    disabled={waTemplatesLoading || waTemplatesSaving}
                                    style={{
                                        padding: '0.55rem 0.9rem',
                                        borderRadius: '8px',
                                        border: '1px solid #3b4452',
                                        background: '#21262d',
                                        color: '#e6edf3',
                                        cursor: waTemplatesLoading || waTemplatesSaving ? 'not-allowed' : 'pointer',
                                        fontWeight: 600,
                                        opacity: waTemplatesLoading || waTemplatesSaving ? 0.6 : 1
                                    }}
                                >
                                    {isAr ? 'إدارة القوالب (إضافة / تعديل / حذف)' : 'Manage templates (add / edit / delete)'}
                                </button>
                            </div>

                            {waManageOpen && (
                                <div
                                    style={{
                                        border: '1px solid #30363d',
                                        borderRadius: '10px',
                                        padding: '1rem',
                                        background: '#111827',
                                        display: 'grid',
                                        gap: '0.9rem',
                                        textAlign: adminAlign(isAr)
                                    }}
                                >
                                    <div style={{ fontWeight: 700, color: '#e6edf3' }}>
                                        {isAr ? 'محرر القوالب' : 'Template editor'}
                                    </div>
                                    {waLocalTemplates.map((row) => (
                                        <div
                                            key={row.id}
                                            style={{
                                                border: '1px solid #30363d',
                                                borderRadius: '8px',
                                                padding: '0.85rem',
                                                display: 'grid',
                                                gap: '0.5rem',
                                                background: '#0d1117'
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    gap: '0.5rem',
                                                    flexWrap: 'wrap',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <input
                                                    value={row.label}
                                                    onChange={(e) => patchWaLocalRow(row.id, 'label', e.target.value)}
                                                    placeholder={isAr ? 'عنوان القالب' : 'Template title'}
                                                    style={{
                                                        flex: '1 1 200px',
                                                        padding: '0.55rem 0.65rem',
                                                        borderRadius: '6px',
                                                        border: '1px solid #30363d',
                                                        background: '#161b22',
                                                        color: '#e6edf3'
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeWaLocalRow(row.id)}
                                                    disabled={waTemplatesSaving}
                                                    style={{
                                                        padding: '0.5rem 0.75rem',
                                                        borderRadius: '6px',
                                                        border: '1px solid #f85149',
                                                        background: 'transparent',
                                                        color: '#f85149',
                                                        cursor: waTemplatesSaving ? 'not-allowed' : 'pointer',
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    {isAr ? 'حذف' : 'Delete'}
                                                </button>
                                            </div>
                                            <textarea
                                                value={row.body}
                                                onChange={(e) => patchWaLocalRow(row.id, 'body', e.target.value)}
                                                rows={7}
                                                placeholder={isAr ? 'نص الرسالة… استخدم الوسوم أعلاه' : 'Message body… use placeholders above'}
                                                style={{
                                                    width: '100%',
                                                    boxSizing: 'border-box',
                                                    padding: '0.65rem',
                                                    borderRadius: '8px',
                                                    border: '1px solid #30363d',
                                                    background: '#161b22',
                                                    color: '#e6edf3',
                                                    lineHeight: 1.5,
                                                    resize: 'vertical',
                                                    fontFamily: 'inherit'
                                                }}
                                            />
                                            <div style={{ fontSize: '0.7rem', color: '#6e7681' }}>
                                                {isAr ? 'المعرّف:' : 'ID:'} <code style={{ color: '#8b949e' }}>{row.id}</code>
                                            </div>
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <button
                                            type="button"
                                            onClick={addWaLocalTemplate}
                                            disabled={waTemplatesSaving}
                                            style={{
                                                padding: '0.55rem 0.9rem',
                                                borderRadius: '8px',
                                                border: '1px solid #3fb950',
                                                background: 'rgba(63,185,80,0.12)',
                                                color: '#3fb950',
                                                fontWeight: 700,
                                                cursor: waTemplatesSaving ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            {isAr ? '+ إضافة قالب' : '+ Add template'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={saveWaTemplatesFromManage}
                                            disabled={waTemplatesSaving}
                                            style={{
                                                padding: '0.55rem 0.9rem',
                                                borderRadius: '8px',
                                                border: 'none',
                                                background: '#238636',
                                                color: '#fff',
                                                fontWeight: 700,
                                                cursor: waTemplatesSaving ? 'not-allowed' : 'pointer',
                                                opacity: waTemplatesSaving ? 0.7 : 1
                                            }}
                                        >
                                            {waTemplatesSaving
                                                ? (isAr ? 'جاري الحفظ…' : 'Saving…')
                                                : (isAr ? 'حفظ القوالب' : 'Save templates')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={cancelWaTemplateManage}
                                            disabled={waTemplatesSaving}
                                            style={{
                                                padding: '0.55rem 0.9rem',
                                                borderRadius: '8px',
                                                border: '1px solid #3b4452',
                                                background: '#21262d',
                                                color: '#e6edf3',
                                                fontWeight: 600,
                                                cursor: waTemplatesSaving ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            {isAr ? 'إلغاء' : 'Cancel'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'grid', gap: '0.45rem' }}>
                                <div style={{ fontSize: '0.72rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    {isAr ? "معاينة الرسالة" : "Message Preview"}
                                </div>
                                <textarea
                                    readOnly
                                    value={selectedWhatsAppTemplate?.message || ''}
                                    style={{
                                        minHeight: '240px',
                                        resize: 'vertical',
                                        padding: '0.9rem',
                                        borderRadius: '10px',
                                        border: '1px solid #30363d',
                                        background: '#0d1117',
                                        color: '#e6edf3',
                                        lineHeight: 1.55
                                    }}
                                />
                            </div>

                            {(previewLinks?.front || previewLinks?.back) && (
                                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                    {previewLinks.front && (
                                        <a
                                            href={previewLinks.front}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                                padding: '0.58rem 0.9rem',
                                                borderRadius: '6px',
                                                border: '1px solid #3b4452',
                                                background: '#0d1117',
                                                color: '#58a6ff',
                                                textDecoration: 'none'
                                            }}
                                        >
                                            {isAr ? "فتح صورة الأمام" : "Open Front Image"}
                                        </a>
                                    )}
                                    {previewLinks.back && (
                                        <a
                                            href={previewLinks.back}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                                padding: '0.58rem 0.9rem',
                                                borderRadius: '6px',
                                                border: '1px solid #3b4452',
                                                background: '#0d1117',
                                                color: '#58a6ff',
                                                textDecoration: 'none'
                                            }}
                                        >
                                            {isAr ? "فتح صورة الخلف" : "Open Back Image"}
                                        </a>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={handleSendWhatsApp}
                                    disabled={
                                        waTemplatesLoading ||
                                        !customerPhoneDigits ||
                                        !selectedWhatsAppTemplate?.message
                                    }
                                    style={{
                                        padding: '0.7rem 1.1rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #f6d365 0%, #f5b942 100%)',
                                        color: '#0d1117',
                                        fontWeight: 700,
                                        cursor:
                                            waTemplatesLoading ||
                                            !customerPhoneDigits ||
                                            !selectedWhatsAppTemplate?.message
                                                ? 'not-allowed'
                                                : 'pointer',
                                        opacity:
                                            waTemplatesLoading ||
                                            !customerPhoneDigits ||
                                            !selectedWhatsAppTemplate?.message
                                                ? 0.6
                                                : 1
                                    }}
                                >
                                    {isAr ? "إرسال عبر واتساب" : "Send by WhatsApp"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminOrders;
