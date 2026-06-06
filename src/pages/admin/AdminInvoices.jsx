import React, { useEffect, useMemo, useState } from 'react';
import ShippingAddressDisplay from '../../components/ShippingAddressDisplay.jsx';
import {
  formatDate,
  getCustomerName,
  getInvoiceNumber,
  getInvoiceStatus,
  getOrderTotal,
  loadOrders
} from './adminOrderData';
import LoadingState from '../../components/LoadingState.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import AdminDataGrid, { AdminDataGridCell, AdminDataGridHeader, AdminDataGridRow } from './components/AdminDataGrid.jsx';
import AdminDetailModal from './components/AdminDetailModal.jsx';
import AdminDetailField from './components/AdminDetailField.jsx';
import AdminEmptyState from './components/AdminEmptyState.jsx';
const LIST_COLUMNS = '1.1fr 1.3fr 0.8fr 0.9fr';

const AdminInvoices = ({ lang = 'ar' }) => {
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

  const openDetail = (orderId) => {
    setSelectedId(orderId);
    setDetailOpen(true);
  };

  if (loading) return <LoadingState message={isAr ? 'جاري تحميل الفواتير...' : 'Loading invoices...'} minHeight="32vh" />;
  if (!orders.length) {
    return <AdminEmptyState lang={lang} message={isAr ? 'لا توجد فواتير حالياً.' : 'No invoices available.'} />;
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
              <div>{isAr ? 'رقم الفاتورة' : 'Invoice #'}</div>
              <div>{isAr ? 'العميل' : 'Customer'}</div>
              <div>{isAr ? 'الإجمالي' : 'Total'}</div>
              <div>{isAr ? 'التاريخ' : 'Date'}</div>
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
              <AdminDataGridCell mono>{getInvoiceNumber(order)}</AdminDataGridCell>
              <AdminDataGridCell>{getCustomerName(order)}</AdminDataGridCell>
              <AdminDataGridCell numeric>{getOrderTotal(order).toFixed(2)} BHD</AdminDataGridCell>
              <AdminDataGridCell muted>{formatDate(order.createdAt)}</AdminDataGridCell>
            </AdminDataGridRow>
          ))}
        </AdminDataGrid>
      </AdminPanel>

      <AdminDetailModal
        open={detailOpen && !!selectedOrder}
        onClose={() => setDetailOpen(false)}
        title={isAr ? 'تفاصيل الفاتورة' : 'Invoice details'}
        subtitle={selectedOrder ? getInvoiceNumber(selectedOrder) : ''}
        isAr={isAr}
        width="min(760px, 100%)"
      >
        {selectedOrder && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div className="admin-detail-grid">
              <div className="admin-detail-card">
                <AdminDetailField isAr={isAr} label={isAr ? 'العميل' : 'Customer'} value={getCustomerName(selectedOrder)} />
                <div style={{ height: '0.75rem' }} />
                <AdminDetailField isAr={isAr} label={isAr ? 'الحالة' : 'Status'} value={getInvoiceStatus(selectedOrder)} />
              </div>
              <div className="admin-detail-card">
                <AdminDetailField isAr={isAr} label={isAr ? 'التاريخ' : 'Date'} value={formatDate(selectedOrder.createdAt)} />
                <div style={{ height: '0.75rem' }} />
                <AdminDetailField isAr={isAr} label={isAr ? 'المجموع' : 'Total Amount'} value={`${getOrderTotal(selectedOrder).toFixed(2)} BHD`} />
              </div>
            </div>
            <div className="admin-detail-card">
              <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>{isAr ? 'عنوان الشحن' : 'Shipping Address'}</div>
              <ShippingAddressDisplay shipping={selectedOrder.shipping} lang={lang} isAr={isAr} />
            </div>
            <div className="admin-detail-card">
              <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>{isAr ? 'العناصر' : 'Items'}</div>
              <AdminPanel>
                <AdminDataGrid
                  lang={lang}
                  columnTemplate="1fr 0.45fr"
                  header={(
                    <AdminDataGridHeader columnTemplate="1fr 0.45fr" lang={lang}>
                      <div>{isAr ? 'العنصر' : 'Item'}</div>
                      <div>{isAr ? 'السعر' : 'Price'}</div>
                    </AdminDataGridHeader>
                  )}
                >
                  {(selectedOrder.items || []).map((item, idx) => (
                    <AdminDataGridRow key={idx} as="div" columnTemplate="1fr 0.45fr" lang={lang}>
                      <AdminDataGridCell>
                        {item.name}
                        {' '}
                        <span className="admin-data-grid__cell--muted">x{item.quantity || 1}</span>
                      </AdminDataGridCell>
                      <AdminDataGridCell numeric>{Number(item.price || 0).toFixed(2)} BHD</AdminDataGridCell>
                    </AdminDataGridRow>
                  ))}
                </AdminDataGrid>
              </AdminPanel>
            </div>
          </div>
        )}
      </AdminDetailModal>
    </>
  );
};

export default AdminInvoices;
