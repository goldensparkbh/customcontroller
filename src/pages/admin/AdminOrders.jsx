import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../../firebase';
import { collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { getOrderNumber, padNumericString } from './recordNumbers';
import LoadingState from '../../components/LoadingState.jsx';

const LIST_COLUMNS = '1.1fr 1.25fr 0.8fr 0.95fr 0.9fr 0.9fr';
const ORDER_STATUS_OPTIONS = ['Paid', 'On Going', 'Completed', 'Shipped', 'Canceled'];
const ORDER_URGENCY_OPTIONS = ['Normal', 'Urgent', 'Very Urgent'];
const PART_DISPLAY_ORDER = ['shell', 'trimpiece', 'touchpad', 'allButtons', 'sticks', 'bumpersTriggers', 'psButton', 'backShellMain'];
const PART_LABELS = {
    shell: 'Shell',
    trimpiece: 'Trim Piece',
    touchpad: 'Touchpad',
    allButtons: 'Buttons',
    sticks: 'Sticks',
    bumpersTriggers: 'Bumpers & Triggers',
    psButton: 'PS Button',
    backShellMain: 'Back Shell'
};

const humanizeKey = (value) => String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getPartDisplayLabel = (partId) => PART_LABELS[partId] || humanizeKey(partId) || 'Part';
const getVariantDisplayLabel = (variant) =>
    variant?.valName ||
    variant?.name ||
    variant?.label ||
    variant?.title ||
    (variant?.hex ? String(variant.hex).toUpperCase() : '') ||
    humanizeKey(variant?.key) ||
    'Selected';
const isGamemodeVariant = (variant) => /gamemode|performance/i.test(
    [
        variant?.type,
        variant?.name,
        variant?.valName,
        variant?.label,
        variant?.key
    ].filter(Boolean).join(' ')
);
const getPartSortIndex = (partId) => {
    const index = PART_DISPLAY_ORDER.indexOf(partId);
    return index >= 0 ? index : PART_DISPLAY_ORDER.length + 1;
};

const getItemCustomizationGroups = (item) => {
    const colors = [];
    const options = [];
    const legacy = [];

    if (item?.parts && typeof item.parts === 'object') {
        Object.entries(item.parts)
            .sort(([partIdA], [partIdB]) => getPartSortIndex(partIdA) - getPartSortIndex(partIdB))
            .forEach(([partId, partState]) => {
                if (partState?.color) {
                    colors.push({
                        partId,
                        partLabel: getPartDisplayLabel(partId),
                        value: getVariantDisplayLabel(partState.color),
                        swatch: partState.color?.hex || ''
                    });
                }

                if (partState?.option?.key && partState.option.key !== 'standard') {
                    options.push({
                        partId,
                        partLabel: getPartDisplayLabel(partId),
                        value: getVariantDisplayLabel(partState.option),
                        kind: isGamemodeVariant(partState.option) ? 'Gamemode' : 'Option'
                    });
                }
            });
    }

    if ((!colors.length && !options.length) && item?.config && typeof item.config === 'object') {
        Object.entries(item.config)
            .filter(([, value]) => value)
            .forEach(([key, value]) => {
                legacy.push({
                    key: humanizeKey(key),
                    value: String(value)
                });
            });
    }

    return { colors, options, legacy };
};

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

const buildWhatsAppTemplates = (order, trackingNumber, origin) => {
    if (!order) return [];

    const customerName = getCustomerName(order);
    const orderNumber = getOrderNumberLabel(order);
    const previewLinks = getFirstPreviewLinks(order, origin);
    const previewBlock = previewLinks && (previewLinks.front || previewLinks.back)
        ? [
            'Customized controller images:',
            previewLinks.front ? `Front: ${previewLinks.front}` : '',
            previewLinks.back ? `Back: ${previewLinks.back}` : ''
        ].filter(Boolean).join('\n')
        : '';
    const trackingLine = trackingNumber ? `Shipping tracking number: ${trackingNumber}` : 'Shipping tracking number: Pending assignment';

    return [
        {
            key: 'order_confirmed',
            label: 'Order Confirmed',
            message: [
                `Hello ${customerName},`,
                `Your order ${orderNumber} has been received successfully.`,
                'We will update you once your customized controller is ready.',
                'Thank you.'
            ].join('\n')
        },
        {
            key: 'controller_ready',
            label: 'Controller Ready',
            message: [
                `Hello ${customerName},`,
                `Your customized controller for order ${orderNumber} is ready.`,
                trackingLine,
                previewBlock,
                'Thank you.'
            ].filter(Boolean).join('\n')
        },
        {
            key: 'order_shipped',
            label: 'Order Shipped',
            message: [
                `Hello ${customerName},`,
                `Your order ${orderNumber} has been shipped.`,
                trackingLine,
                'Thank you.'
            ].join('\n')
        }
    ];
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

const sectionCardStyle = {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '10px',
    overflow: 'hidden'
};

const listCellStyle = {
    minWidth: 0,
    textAlign: 'left'
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

const DetailField = ({ label, value }) => (
    <div style={{ display: 'grid', gap: '0.2rem' }}>
        <div style={{ fontSize: '0.72rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
        </div>
        <div style={{ color: '#e6edf3', lineHeight: 1.45 }}>{value || 'N/A'}</div>
    </div>
);

const DetailActionField = ({ label, value, helperText, onClick, disabled }) => (
    <div style={{ display: 'grid', gap: '0.2rem' }}>
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
                textAlign: 'left',
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

const AdminOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailStatus, setDetailStatus] = useState('Paid');
    const [detailUrgency, setDetailUrgency] = useState('Normal');
    const [detailTrackingNumber, setDetailTrackingNumber] = useState('');
    const [whatsAppOpen, setWhatsAppOpen] = useState(false);
    const [selectedTemplateKey, setSelectedTemplateKey] = useState('controller_ready');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [urgencyFilter, setUrgencyFilter] = useState('all');
    const [saving, setSaving] = useState(false);

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

    const customerPhoneDigits = useMemo(
        () => normalizeWhatsAppPhone(selectedOrder?.customer?.phone),
        [selectedOrder]
    );

    const whatsAppTemplates = useMemo(
        () => buildWhatsAppTemplates(
            selectedOrder,
            detailTrackingNumber.trim(),
            typeof window !== 'undefined' ? window.location.origin : ''
        ),
        [detailTrackingNumber, selectedOrder]
    );

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
    };

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

    if (loading) return <LoadingState message="Loading orders..." minHeight="32vh" />;

    if (orders.length === 0) {
        return (
            <div>
                <p>No orders found in Firebase.</p>
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
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <div style={{ fontSize: '0.74rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Search
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search by order, customer, phone, tracking, payment ref"
                        style={{
                            padding: '0.72rem 0.8rem',
                            borderRadius: '8px',
                            border: '1px solid #30363d',
                            background: '#0d1117',
                            color: '#e6edf3'
                        }}
                    />
                </div>

                <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <div style={{ fontSize: '0.74rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Status
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
                        <option value="all">All Statuses</option>
                        {ORDER_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <div style={{ fontSize: '0.74rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Payment
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
                        <option value="all">All Payments</option>
                        {paymentStatusOptions.map((status) => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <div style={{ fontSize: '0.74rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Urgency
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
                        <option value="all">All Urgency</option>
                        {ORDER_URGENCY_OPTIONS.map((urgency) => (
                            <option key={urgency} value={urgency}>{urgency}</option>
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
                    Reset
                </button>
            </div>

            <section style={sectionCardStyle}>
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
                    <div style={listCellStyle}>Order</div>
                    <div style={listCellStyle}>Customer</div>
                    <div style={listCellStyle}>Total</div>
                    <div style={listCellStyle}>Payment</div>
                    <div style={listCellStyle}>Urgency</div>
                    <div style={listCellStyle}>Status</div>
                </div>

                <div style={{ display: 'grid' }}>
                    {filteredOrders.map((order) => {
                        const isSelected = detailOpen && order.id === selectedOrderId;
                        return (
                            <button
                                key={order.id}
                                type="button"
                                onClick={() => openOrderDetails(order.id)}
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
                                        {(order.items || []).length} item(s)
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
                                        {normalizeOrderUrgency(order.urgency)}
                                    </span>
                                </div>

                                <div style={listCellStyle}>
                                    <span style={getStatusBadgeStyle(order.status || 'Paid')}>
                                        {normalizeOrderStatus(order.status, order)}
                                    </span>
                                </div>
                            </button>
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
                            No orders match the current filters.
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
                            <div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e6edf3' }}>
                                    Order Details
                                </div>
                                <div style={{ marginTop: '0.3rem', fontFamily: 'Consolas, monospace', color: '#8b949e' }}>
                                    {getOrderNumberLabel(selectedOrder)}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={getStatusBadgeStyle(selectedOrder.status || 'Paid')}>
                                    {normalizeOrderStatus(selectedOrder.status, selectedOrder)}
                                </span>
                                <button
                                    type="button"
                                    onClick={fetchOrders}
                                    style={{
                                        padding: '0.55rem 0.8rem',
                                        borderRadius: '6px',
                                        border: '1px solid #3b4452',
                                        background: '#0d1117',
                                        color: '#e6edf3',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Refresh
                                </button>
                                <button
                                    type="button"
                                    onClick={closeOrderDetails}
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
                                    <DetailField label="Customer" value={getCustomerName(selectedOrder)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField label="Email" value={selectedOrder.customer?.email} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailActionField
                                        label="Phone"
                                        value={selectedOrder.customer?.phone}
                                        helperText="Click to choose a WhatsApp template and send it."
                                        onClick={openWhatsAppModal}
                                        disabled={!customerPhoneDigits}
                                    />
                                </div>

                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem' }}>
                                    <DetailField label="Shipping Method" value={selectedOrder.shipping?.method} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField label="Address" value={formatAddress(selectedOrder.shipping)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField label="Shipping Number" value={getTrackingNumber(selectedOrder)} />
                                </div>

                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem' }}>
                                    <DetailField label="Payment Method" value={getPaymentMethod(selectedOrder)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField label="Payment Status" value={getPaymentStatus(selectedOrder)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField label="Reference" value={getPaymentReference(selectedOrder)} />
                                </div>

                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem' }}>
                                    <DetailField label="Created" value={formatDate(selectedOrder.createdAt)} />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField
                                        label="Total"
                                        value={`${Number(selectedOrder.total || 0).toFixed(2)} ${selectedOrder.currency || 'BHD'}`}
                                    />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField
                                        label="Items"
                                        value={`${(selectedOrder.items || []).length} item(s)`}
                                    />
                                    <div style={{ height: '0.75rem' }} />
                                    <DetailField
                                        label="Urgency"
                                        value={normalizeOrderUrgency(selectedOrder.urgency)}
                                    />
                                </div>
                            </div>

                            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#e6edf3' }}>Update Order</div>
                                        <div style={{ fontSize: '0.82rem', color: '#8b949e', marginTop: '0.2rem' }}>
                                            Change the operational status for this purchase order.
                                        </div>
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
                                                <option key={status} value={status}>{status}</option>
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
                                                <option key={urgency} value={urgency}>{urgency}</option>
                                            ))}
                                        </select>

                                        <input
                                            type="text"
                                            value={detailTrackingNumber}
                                            onChange={(event) => setDetailTrackingNumber(event.target.value)}
                                            placeholder="Shipping number"
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
                                            {saving ? 'Saving...' : 'Update Order'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gap: '0.9rem' }}>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e6edf3' }}>Order Items</div>

                                {(selectedOrder.items || []).map((item, idx) => (
                                    (() => {
                                        const customizationGroups = getItemCustomizationGroups(item);
                                        return (
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
                                            <DetailField label="Quantity" value={String(item.quantity || 1)} />
                                            <DetailField label="Line Total" value={`${getItemLineTotal(item).toFixed(2)} BHD`} />

                                            {(customizationGroups.colors.length > 0 || customizationGroups.options.length > 0 || customizationGroups.legacy.length > 0) && (
                                                <div style={{ display: 'grid', gap: '0.35rem' }}>
                                                    <div style={{ fontSize: '0.72rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                        Customizations
                                                    </div>
                                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                        {customizationGroups.colors.length > 0 && (
                                                            <div style={{ display: 'grid', gap: '0.35rem' }}>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e6edf3' }}>
                                                                    Color Options
                                                                </div>
                                                                <div style={{ display: 'grid', gap: '0.3rem' }}>
                                                                    {customizationGroups.colors.map((entry) => (
                                                                        <div key={`color-${entry.partId}`} style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', color: '#c7d2de' }}>
                                                                            <span
                                                                                style={{
                                                                                    width: '12px',
                                                                                    height: '12px',
                                                                                    borderRadius: '50%',
                                                                                    background: entry.swatch || '#8b949e',
                                                                                    border: '1px solid rgba(255,255,255,0.25)',
                                                                                    flexShrink: 0
                                                                                }}
                                                                            />
                                                                            <span>
                                                                                <strong style={{ color: '#e6edf3' }}>{entry.partLabel}:</strong> {entry.value}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {customizationGroups.options.length > 0 && (
                                                            <div style={{ display: 'grid', gap: '0.35rem' }}>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e6edf3' }}>
                                                                    Performance / Option Selections
                                                                </div>
                                                                <div style={{ display: 'grid', gap: '0.3rem' }}>
                                                                    {customizationGroups.options.map((entry) => (
                                                                        <div key={`option-${entry.partId}-${entry.value}`} style={{ color: '#c7d2de' }}>
                                                                            <strong style={{ color: '#e6edf3' }}>{entry.partLabel}:</strong> {entry.value}
                                                                            <span style={{ color: '#8b949e' }}> ({entry.kind})</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {customizationGroups.legacy.length > 0 && (
                                                            <div style={{ display: 'grid', gap: '0.3rem' }}>
                                                                {customizationGroups.legacy.map((entry) => (
                                                                    <div key={`legacy-${entry.key}`} style={{ color: '#c7d2de' }}>
                                                                        <strong style={{ color: '#e6edf3' }}>{entry.key}:</strong> {entry.value}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                        );
                                    })()
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
                                    WhatsApp Message
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
                                Close
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                {whatsAppTemplates.map((template) => {
                                    const isActive = template.key === selectedWhatsAppTemplate?.key;
                                    return (
                                        <button
                                            key={template.key}
                                            type="button"
                                            onClick={() => setSelectedTemplateKey(template.key)}
                                            style={{
                                                padding: '0.58rem 0.9rem',
                                                borderRadius: '999px',
                                                border: isActive ? '1px solid #f5c542' : '1px solid #3b4452',
                                                background: isActive ? 'rgba(245,197,66,0.12)' : '#0d1117',
                                                color: '#e6edf3',
                                                cursor: 'pointer',
                                                fontWeight: 600
                                            }}
                                        >
                                            {template.label}
                                        </button>
                                    );
                                })}
                            </div>

                            <div style={{ display: 'grid', gap: '0.45rem' }}>
                                <div style={{ fontSize: '0.72rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    Message Preview
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
                                            Open Front Image
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
                                            Open Back Image
                                        </a>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={handleSendWhatsApp}
                                    disabled={!customerPhoneDigits || !selectedWhatsAppTemplate?.message}
                                    style={{
                                        padding: '0.7rem 1.1rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #f6d365 0%, #f5b942 100%)',
                                        color: '#0d1117',
                                        fontWeight: 700,
                                        cursor: !customerPhoneDigits || !selectedWhatsAppTemplate?.message ? 'not-allowed' : 'pointer',
                                        opacity: !customerPhoneDigits || !selectedWhatsAppTemplate?.message ? 0.6 : 1
                                    }}
                                >
                                    Send by WhatsApp
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
