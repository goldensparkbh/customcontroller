import React, { useEffect, useMemo, useState } from 'react';
import {
  buildCustomerSummaries,
  formatAddress,
  formatDate,
  getOrderNumberLabel,
  getOrderStatus,
  panelStyle,
  loadOrders
} from './adminOrderData';
import LoadingState from '../../components/LoadingState.jsx';
import { i18n } from '../../i18n';
import { adminAlign } from './adminUi.js';

const LIST_COLUMNS = '1.4fr 0.7fr 0.8fr 1fr';

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

const AdminCustomers = ({ lang = 'ar' }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState('');
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
        const summaries = buildCustomerSummaries(nextOrders);
        setSelectedKey((current) => (summaries.some((customer) => customer.key === current) ? current : ''));
      } catch (error) {
        console.error('Failed to load customers', error);
      }
      setLoading(false);
    };
    run();
  }, []);

  const customers = useMemo(() => buildCustomerSummaries(orders), [orders]);
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.key === selectedKey) || null,
    [customers, selectedKey]
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

  const openDetail = (customerKey) => {
    setSelectedKey(customerKey);
    setDetailOpen(true);
  };

  if (loading) return <LoadingState message={isAr ? "جاري تحميل العملاء..." : "Loading customers..."} minHeight="32vh" />;
  if (!customers.length) return <p style={{ padding: '2rem', textAlign: 'center', color: '#8b949e' }}>{isAr ? "لا يوجد عملاء حالياً." : "No customers available."}</p>;

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
          <div>{isAr ? "العميل" : "Customer"}</div>
          <div>{isAr ? "الطلبات" : "Orders"}</div>
          <div>{isAr ? "الإنفاق" : "Spend"}</div>
          <div>{isAr ? "الأحدث" : "Latest"}</div>
        </div>

        <div style={{ display: 'grid' }}>
          {customers.map((customer) => {
            const isSelected = detailOpen && customer.key === selectedKey;
            return (
              <button
                key={customer.key}
                type="button"
                onClick={() => openDetail(customer.key)}
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
                <div>
                  <div>{customer.name}</div>
                  <div style={{ fontSize: '0.76rem', color: '#8b949e', marginTop: '0.2rem' }}>{customer.email}</div>
                </div>
                <div>{customer.orders.length}</div>
                <div>{customer.totalSpend.toFixed(2)} BHD</div>
                <div>{formatDate(customer.latestDate)}</div>
              </button>
            );
          })}
        </div>
      </section>

      {detailOpen && selectedCustomer && (
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
              <div style={{ textAlign: adminAlign(isAr) }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e6edf3' }}>{isAr ? "تفاصيل العميل" : "Customer Details"}</div>
                <div style={{ marginTop: '0.3rem', color: '#8b949e' }}>{selectedCustomer.name}</div>
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
                  <DetailField isAr={isAr} label={isAr ? "البريد الإلكتروني" : "Email"} value={selectedCustomer.email} />
                  <div style={{ height: '0.75rem' }} />
                  <DetailField isAr={isAr} label={isAr ? "الهاتف" : "Phone"} value={selectedCustomer.phone} />
                </div>

                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '0.9rem' }}>
                  <DetailField isAr={isAr} label={isAr ? "عدد الطلبات" : "Orders"} value={String(selectedCustomer.orders.length)} />
                  <div style={{ height: '0.75rem' }} />
                  <DetailField isAr={isAr} label={isAr ? "إجمالي الإنفاق" : "Lifetime Spend"} value={`${selectedCustomer.totalSpend.toFixed(2)} BHD`} />
                </div>
              </div>

              <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#e6edf3', marginBottom: '0.75rem', textAlign: adminAlign(isAr) }}>{isAr ? "طلبات العميل" : "Customer Orders"}</div>
                <div style={{ display: 'grid', gap: '0.7rem' }}>
                  {selectedCustomer.orders.map((order) => (
                    <div
                      key={order.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 0.8fr 0.9fr',
                        gap: '0.75rem',
                        padding: '0.8rem',
                        background: '#111827',
                        borderRadius: '8px',
                        color: '#d6d9e0',
                        direction: isAr ? 'rtl' : 'ltr',
                        textAlign: adminAlign(isAr)
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: 'Consolas, monospace' }}>{getOrderNumberLabel(order)}</div>
                        <div style={{ fontSize: '0.76rem', color: '#8b949e', marginTop: '0.2rem' }}>{formatDate(order.createdAt)}</div>
                      </div>
                      <div>{Number(order.total || 0).toFixed(2)} {order.currency || 'BHD'}</div>
                      <div>{getOrderStatus(order)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#e6edf3', marginBottom: '0.75rem' }}>{isAr ? "آخر عنوان شحن" : "Latest Shipping Address"}</div>
                <div style={{ color: '#d6d9e0' }}>{formatAddress(selectedCustomer.orders[0]?.shipping)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCustomers;
