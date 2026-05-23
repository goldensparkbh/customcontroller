import React, { useEffect, useMemo, useState } from 'react';
import ShippingAddressDisplay from '../../components/ShippingAddressDisplay.jsx';
import {
  formatDate,
  getCustomerName,
  getInvoiceNumber,
  getInvoiceStatus,
  getOrderTotal,
  loadOrders,
  panelStyle
} from './adminOrderData';
import LoadingState from '../../components/LoadingState.jsx';
import { i18n } from '../../i18n';
import { adminAlign } from './adminUi.js';

const LIST_COLUMNS = '1.1fr 1.3fr 0.8fr 0.9fr';

const modalOverlayStyle = {
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

const AdminInvoices = ({ lang = 'ar' }) => {
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
        console.error('Failed to load invoices', error);
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

  if (loading) return <LoadingState message={isAr ? "جاري تحميل الفواتير..." : "Loading invoices..."} minHeight="32vh" />;
  if (!orders.length) return <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--admin-muted)' }}>{isAr ? "لا توجد فواتير حالياً." : "No invoices available."}</p>;

  return (
    <div>
      <section style={panelStyle}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: LIST_COLUMNS,
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            background: 'var(--admin-raised)',
            borderBottom: '1px solid var(--admin-border)',
            fontSize: '0.72rem',
            color: 'var(--admin-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            textAlign: adminAlign(isAr)
          }}
        >
          <div>{isAr ? "رقم الفاتورة" : "Invoice #"}</div>
          <div>{isAr ? "العميل" : "Customer"}</div>
          <div>{isAr ? "الإجمالي" : "Total"}</div>
          <div>{isAr ? "التاريخ" : "Date"}</div>
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
                  color: 'var(--admin-text)',
                  textAlign: adminAlign(isAr),
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontFamily: 'Consolas, monospace' }}>{getInvoiceNumber(order)}</div>
                <div>{getCustomerName(order)}</div>
                <div>{getOrderTotal(order).toFixed(2)} BHD</div>
                <div>{formatDate(order.createdAt)}</div>
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
              width: 'min(760px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--admin-surface)',
              border: '1px solid var(--admin-border)',
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
                borderBottom: '1px solid var(--admin-border)',
                background: 'var(--admin-surface)',
                flexDirection: isAr ? 'row-reverse' : 'row'
              }}
            >
              <div style={{ textAlign: adminAlign(isAr) }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--admin-text)' }}>{isAr ? "تفاصيل الفاتورة" : "Invoice details"}</div>
                <div style={{ marginTop: '0.3rem', fontFamily: 'Consolas, monospace', color: 'var(--admin-muted)' }}>
                  {getInvoiceNumber(selectedOrder)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                style={{
                  padding: '0.55rem 0.8rem',
                  borderRadius: '6px',
                  border: '1px solid var(--admin-border-strong)',
                  background: 'var(--admin-raised)',
                  color: 'var(--admin-text)',
                  cursor: 'pointer'
                }}
              >
                {isAr ? "إغلاق" : "Close"}
              </button>
            </div>

            <div style={{ display: 'grid', gap: '1rem', padding: '1.25rem 1.5rem', direction: isAr ? 'rtl' : 'ltr', textAlign: adminAlign(isAr) }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
                <div style={{ background: 'var(--admin-raised)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '0.9rem' }}>
                  <DetailField isAr={isAr} label={isAr ? "العميل" : "Customer"} value={getCustomerName(selectedOrder)} />
                  <div style={{ height: '0.75rem' }} />
                  <DetailField isAr={isAr} label={isAr ? "الحالة" : "Status"} value={getInvoiceStatus(selectedOrder)} />
                </div>

                <div style={{ background: 'var(--admin-raised)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '0.9rem' }}>
                  <DetailField isAr={isAr} label={isAr ? "التاريخ" : "Date"} value={formatDate(selectedOrder.createdAt)} />
                  <div style={{ height: '0.75rem' }} />
                  <DetailField isAr={isAr} label={isAr ? "المجموع" : "Total Amount"} value={`${getOrderTotal(selectedOrder).toFixed(2)} BHD`} />
                </div>
              </div>

              <div style={{ background: 'var(--admin-raised)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--admin-text)', marginBottom: '0.75rem', textAlign: adminAlign(isAr) }}>{isAr ? "عنوان الشحن" : "Shipping Address"}</div>
                <ShippingAddressDisplay shipping={selectedOrder.shipping} lang={lang} isAr={isAr} />
              </div>

              <div style={{ background: 'var(--admin-raised)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--admin-text)', marginBottom: '0.75rem', textAlign: adminAlign(isAr) }}>{isAr ? "العناصر" : "Items"}</div>
                <div style={{ display: 'grid', gap: '0.6rem' }}>
                  {(selectedOrder.items || []).map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.5rem 0',
                        borderBottom: idx === (selectedOrder.items.length - 1) ? 'none' : '1px solid rgba(255,255,255,0.05)'
                      }}
                    >
                      <div style={{ color: '#d6d9e0', flex: 1, textAlign: adminAlign(isAr) }}>
                        {item.name} <span style={{ color: 'var(--admin-muted)', fontSize: '0.85rem' }}>x{item.quantity || 1}</span>
                      </div>
                      <div style={{ color: 'var(--admin-text)', textAlign: adminAlign(isAr), whiteSpace: 'nowrap' }}>{Number(item.price || 0).toFixed(2)} BHD</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInvoices;
