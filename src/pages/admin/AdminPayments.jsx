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
  loadOrders
} from './adminOrderData';
import LoadingState from '../../components/LoadingState.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import AdminDataGrid, { AdminDataGridCell, AdminDataGridHeader, AdminDataGridRow } from './components/AdminDataGrid.jsx';
import AdminDetailModal from './components/AdminDetailModal.jsx';
import AdminDetailField from './components/AdminDetailField.jsx';
import AdminEmptyState from './components/AdminEmptyState.jsx';

const LIST_COLUMNS = '1.2fr 1.2fr 0.8fr 0.9fr 0.9fr';

const AdminPayments = ({ lang = 'ar' }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const isAr = lang === 'ar';

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

  const openDetail = (orderId) => {
    setSelectedId(orderId);
    setDetailOpen(true);
  };

  if (loading) return <LoadingState message={isAr ? 'جاري تحميل المدفوعات...' : 'Loading payments...'} minHeight="32vh" />;
  if (!orders.length) {
    return <AdminEmptyState lang={lang} message={isAr ? 'لا توجد عمليات دفع حالياً.' : 'No payments available.'} />;
  }

  return (
    <>
      <AdminPanel>
        <AdminDataGrid
          lang={lang}
          columnTemplate={LIST_COLUMNS}
          maxHeight="calc(100vh - 260px)"
          header={(
            <AdminDataGridHeader columnTemplate={LIST_COLUMNS} lang={lang}>
              <div>{isAr ? 'المرجع' : 'Reference'}</div>
              <div>{isAr ? 'العميل' : 'Customer'}</div>
              <div>{isAr ? 'المبلغ' : 'Amount'}</div>
              <div>{isAr ? 'الطريقة' : 'Method'}</div>
              <div>{isAr ? 'الحالة' : 'Status'}</div>
            </AdminDataGridHeader>
          )}
        >
          {orders.map((order) => (
            <AdminDataGridRow
              key={order.id}
              columnTemplate={LIST_COLUMNS}
              lang={lang}
              selected={detailOpen && order.id === selectedId}
              onClick={() => openDetail(order.id)}
            >
              <AdminDataGridCell mono>{getPaymentReference(order)}</AdminDataGridCell>
              <AdminDataGridCell>{getCustomerName(order)}</AdminDataGridCell>
              <AdminDataGridCell numeric>{getOrderTotal(order).toFixed(2)} BHD</AdminDataGridCell>
              <AdminDataGridCell>{getPaymentMethod(order)}</AdminDataGridCell>
              <AdminDataGridCell>{getPaymentStatus(order)}</AdminDataGridCell>
            </AdminDataGridRow>
          ))}
        </AdminDataGrid>
      </AdminPanel>

      <AdminDetailModal
        open={detailOpen && !!selectedOrder}
        onClose={() => setDetailOpen(false)}
        title={isAr ? 'تفاصيل الدفع' : 'Payment details'}
        subtitle={selectedOrder ? getPaymentReference(selectedOrder) : ''}
        isAr={isAr}
        width="min(780px, 100%)"
      >
        {selectedOrder && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div className="admin-detail-grid">
              <div className="admin-detail-card">
                <AdminDetailField isAr={isAr} label={isAr ? 'العميل' : 'Customer'} value={getCustomerName(selectedOrder)} />
                <div style={{ height: '0.75rem' }} />
                <AdminDetailField isAr={isAr} label={isAr ? 'البريد الإلكتروني' : 'Email'} value={selectedOrder.customer?.email} />
              </div>
              <div className="admin-detail-card">
                <AdminDetailField isAr={isAr} label={isAr ? 'المبلغ' : 'Amount'} value={`${getOrderTotal(selectedOrder).toFixed(2)} BHD`} />
                <div style={{ height: '0.75rem' }} />
                <AdminDetailField isAr={isAr} label={isAr ? 'الحالة' : 'Status'} value={getPaymentStatus(selectedOrder)} />
              </div>
            </div>
            <div className="admin-detail-card">
              <div className="admin-detail-grid">
                <AdminDetailField isAr={isAr} label={isAr ? 'طريقة الدفع' : 'Payment Method'} value={getPaymentMethod(selectedOrder)} />
                <AdminDetailField isAr={isAr} label={isAr ? 'مرجع العملية' : 'Transaction ID'} value={getPaymentReference(selectedOrder)} mono />
                <AdminDetailField isAr={isAr} label={isAr ? 'التاريخ' : 'Date'} value={formatDate(selectedOrder.createdAt)} />
              </div>
            </div>
            <div className="admin-detail-card">
              <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>{isAr ? 'الطلب المرتبط' : 'Linked Order'}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div className="admin-detail-field__value--mono">{getOrderNumberLabel(selectedOrder)}</div>
                <div style={{ color: 'var(--admin-muted)' }}>{getOrderStatus(selectedOrder)}</div>
              </div>
            </div>
          </div>
        )}
      </AdminDetailModal>
    </>
  );
};

export default AdminPayments;
