import React, { useEffect, useMemo, useState } from 'react';
import ShippingAddressDisplay from '../../components/ShippingAddressDisplay.jsx';
import {
  buildCustomerSummaries,
  formatDate,
  getOrderNumberLabel,
  getOrderStatus,
  loadOrders
} from './adminOrderData';
import LoadingState from '../../components/LoadingState.jsx';
import { i18n } from '../../i18n';
import AdminPanel from './components/AdminPanel.jsx';
import AdminDataGrid, { AdminDataGridCell, AdminDataGridHeader, AdminDataGridRow } from './components/AdminDataGrid.jsx';
import AdminDetailModal from './components/AdminDetailModal.jsx';
import AdminDetailField from './components/AdminDetailField.jsx';
import AdminEmptyState from './components/AdminEmptyState.jsx';

const LIST_COLUMNS = '1.4fr 0.7fr 0.8fr 1fr';

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

  const openDetail = (customerKey) => {
    setSelectedKey(customerKey);
    setDetailOpen(true);
  };

  if (loading) return <LoadingState message={isAr ? 'جاري تحميل العملاء...' : 'Loading customers...'} minHeight="32vh" />;
  if (!customers.length) {
    return (
      <AdminEmptyState
        lang={lang}
        message={isAr ? 'لا يوجد عملاء حالياً.' : 'No customers available.'}
      />
    );
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
              <div>{isAr ? 'العميل' : 'Customer'}</div>
              <div>{isAr ? 'الطلبات' : 'Orders'}</div>
              <div>{isAr ? 'الإنفاق' : 'Spend'}</div>
              <div>{isAr ? 'الأحدث' : 'Latest'}</div>
            </AdminDataGridHeader>
          )}
        >
          {customers.map((customer) => (
            <AdminDataGridRow
              key={customer.key}
              columnTemplate={LIST_COLUMNS}
              lang={lang}
              selected={detailOpen && customer.key === selectedKey}
              onClick={() => openDetail(customer.key)}
            >
              <AdminDataGridCell>
                <div>{customer.name}</div>
                <div className="admin-data-grid__cell--muted">{customer.email}</div>
              </AdminDataGridCell>
              <AdminDataGridCell numeric>{customer.orders.length}</AdminDataGridCell>
              <AdminDataGridCell numeric>{customer.totalSpend.toFixed(2)} BHD</AdminDataGridCell>
              <AdminDataGridCell muted>{formatDate(customer.latestDate)}</AdminDataGridCell>
            </AdminDataGridRow>
          ))}
        </AdminDataGrid>
      </AdminPanel>

      <AdminDetailModal
        open={detailOpen && !!selectedCustomer}
        onClose={() => setDetailOpen(false)}
        title={isAr ? 'تفاصيل العميل' : 'Customer Details'}
        subtitle={selectedCustomer?.name}
        isAr={isAr}
      >
        {selectedCustomer && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div className="admin-detail-grid">
              <div className="admin-detail-card">
                <AdminDetailField isAr={isAr} label={isAr ? 'البريد الإلكتروني' : 'Email'} value={selectedCustomer.email} />
                <div style={{ height: '0.75rem' }} />
                <AdminDetailField isAr={isAr} label={isAr ? 'الهاتف' : 'Phone'} value={selectedCustomer.phone} />
              </div>
              <div className="admin-detail-card">
                <AdminDetailField isAr={isAr} label={isAr ? 'عدد الطلبات' : 'Orders'} value={String(selectedCustomer.orders.length)} />
                <div style={{ height: '0.75rem' }} />
                <AdminDetailField
                  isAr={isAr}
                  label={isAr ? 'إجمالي الإنفاق' : 'Lifetime Spend'}
                  value={`${selectedCustomer.totalSpend.toFixed(2)} BHD`}
                />
              </div>
            </div>

            <div className="admin-detail-card">
              <div style={{ fontWeight: 700, color: 'var(--admin-text)', marginBottom: '0.75rem' }}>
                {isAr ? 'طلبات العميل' : 'Customer Orders'}
              </div>
              <AdminPanel flush>
                <AdminDataGrid
                  lang={lang}
                  columnTemplate="1fr 0.8fr 0.9fr"
                  header={(
                    <AdminDataGridHeader columnTemplate="1fr 0.8fr 0.9fr" lang={lang}>
                      <div>{isAr ? 'الطلب' : 'Order'}</div>
                      <div>{isAr ? 'المبلغ' : 'Amount'}</div>
                      <div>{isAr ? 'الحالة' : 'Status'}</div>
                    </AdminDataGridHeader>
                  )}
                >
                  {selectedCustomer.orders.map((order) => (
                    <AdminDataGridRow
                      key={order.id}
                      as="div"
                      columnTemplate="1fr 0.8fr 0.9fr"
                      lang={lang}
                    >
                      <AdminDataGridCell mono>
                        <div>{getOrderNumberLabel(order)}</div>
                        <div className="admin-data-grid__cell--muted">{formatDate(order.createdAt)}</div>
                      </AdminDataGridCell>
                      <AdminDataGridCell numeric>
                        {Number(order.total || 0).toFixed(2)} {order.currency || 'BHD'}
                      </AdminDataGridCell>
                      <AdminDataGridCell>{getOrderStatus(order)}</AdminDataGridCell>
                    </AdminDataGridRow>
                  ))}
                </AdminDataGrid>
              </AdminPanel>
            </div>

            <div className="admin-detail-card">
              <div style={{ fontWeight: 700, color: 'var(--admin-text)', marginBottom: '0.75rem' }}>
                {isAr ? 'آخر عنوان شحن' : 'Latest Shipping Address'}
              </div>
              <ShippingAddressDisplay shipping={selectedCustomer.orders[0]?.shipping} lang={lang} isAr={isAr} />
            </div>
          </div>
        )}
      </AdminDetailModal>
    </>
  );
};

export default AdminCustomers;
