import React, { useEffect, useMemo, useState } from 'react';
import {
  formatDate,
  getCustomerName,
  getOrderNumberLabel,
  getOrderStatus,
  getOrderTotal,
  getPaymentMethod,
  getPaymentReference,
  getPaymentStatus,
  loadOrders,
  panelStyle
} from './adminOrderData';
import LoadingState from '../../components/LoadingState.jsx';
import { i18n } from '../../i18n';
import { adminAlign } from './adminUi.js';

const LIST_COLUMNS = '1.2fr 1.2fr 0.8fr 0.9fr 0.9fr';

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

const AdminPayments = ({ lang = 'ar' }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);

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

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const nextOrders = await loadOrders();
        setOrders(nextOrders);
        setSelectedId((current) => (nextOrders.some((order) => order.id === current) ? current : ''));
      } catch (error) {
        console.error('Failed to load payments', error);
      }
      setLoading(false);
    };
    run();
  }, []);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedId) || null,
    [orders, selectedId]
  );

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

  const openDetail = (orderId) => {
    setSelectedId(orderId);
    setDetailOpen(true);
  };

  if (loading) return <LoadingState message={isAr ? "جاري تحميل المدفوعات..." : "Loading payments..."} minHeight="32vh" />;
  if (!orders.length) return <p style={{ padding: '2rem', textAlign: 'center', color: '#8b949e' }}>{isAr ? "لا توجد عمليات دفع حالياً." : "No payments available."}</p>;

  return (
    <div>
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
          <div>{isAr ? "المرجع" : "Reference"}</div>
          <div>{isAr ? "العميل" : "Customer"}</div>
          <div>{isAr ? "المبلغ" : "Amount"}</div>
          <div>{isAr ? "الطريقة" : "Method"}</div>
          <div>{isAr ? "الحالة" : "Status"}</div>
        </div>

        <div style={{ display: 'grid' }}>
          {orders.map((order) => {
            const isSelected = detailOpen && order.id === selectedId;
            return (
              <button
                key={order.id}
                type="button"
                onClick={() => openDetail(order.id)}
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
                <div style={{ fontFamily: 'Consolas, monospace' }}>{getPaymentReference(order)}</div>
                <div>{getCustomerName(order)}</div>
                <div>{getOrderTotal(order).toFixed(2)} BHD</div>
                <div>{getPaymentMethod(order)}</div>
                <div>{getPaymentStatus(order)}</div>
              </button>
            );
          })}
        </div>
      </section>

      {detailOpen && selectedOrder && (
        <div onClick={() => setDetailOpen(false)} style={modalOverlayStyle}>
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(780px, 100%)',
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
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e6edf3' }}>{isAr ? "تفاصيل الدفع" : "Payment details"}</div>
                <div style={{ marginTop: '0.3rem', fontFamily: 'Consolas, monospace', color: '#8b949e' }}>
                  {getPaymentReference(selectedOrder)}
                </div>
              </div>

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
                {isAr ? "إغلاق" : "Close"}
              </button>
            </div>

            <div style={{ display: 'grid', gap: '1rem', padding: '1.25rem 1.5rem', direction: isAr ? 'rtl' : 'ltr', textAlign: adminAlign(isAr) }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem' }}>
                  <DetailField isAr={isAr} label={isAr ? "العميل" : "Customer"} value={getCustomerName(selectedOrder)} />
                  <div style={{ height: '0.75rem' }} />
                  <DetailField isAr={isAr} label={isAr ? "البريد الإلكتروني" : "Email"} value={selectedOrder.customer?.email} />
                </div>

                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem' }}>
                  <DetailField isAr={isAr} label={isAr ? "المبلغ" : "Amount"} value={`${getOrderTotal(selectedOrder).toFixed(2)} BHD`} />
                  <div style={{ height: '0.75rem' }} />
                  <DetailField isAr={isAr} label={isAr ? "الحالة" : "Status"} value={getPaymentStatus(selectedOrder)} />
                </div>
              </div>

              <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <DetailField isAr={isAr} label={isAr ? "طريقة الدفع" : "Payment Method"} value={getPaymentMethod(selectedOrder)} />
                  <DetailField isAr={isAr} label={isAr ? "مرجع العملية" : "Transaction ID"} value={getPaymentReference(selectedOrder)} />
                  <DetailField isAr={isAr} label={isAr ? "التاريخ" : "Date"} value={formatDate(selectedOrder.createdAt)} />
                </div>
              </div>

              <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#e6edf3', marginBottom: '0.75rem' }}>{isAr ? "الطلب المرتبط" : "Linked Order"}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: 'Consolas, monospace', color: '#d6d9e0' }}>{getOrderNumberLabel(selectedOrder)}</div>
                  <div style={{ color: '#8b949e' }}>{getOrderStatus(selectedOrder)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPayments;

