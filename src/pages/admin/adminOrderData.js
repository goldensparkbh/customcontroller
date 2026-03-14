import { db } from '../../firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { getOrderNumber, padNumericString } from './recordNumbers';

export const panelStyle = {
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: '10px',
  overflow: 'hidden'
};

export async function loadOrders() {
  try {
    const snapshot = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    if (!error.message.includes('index')) throw error;
    const snapshot = await getDocs(collection(db, 'orders'));
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  }
}

export function formatDate(value) {
  if (!value) return 'N/A';
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
}

function toDateMs(value) {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function getCustomerName(order) {
  const customer = order?.customer || {};
  return [customer.first_name || customer.firstName, customer.last_name || customer.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() || 'N/A';
}

export function getCustomerEmail(order) {
  return order?.customer?.email || 'N/A';
}

export function getCustomerPhone(order) {
  return order?.customer?.phone || 'N/A';
}

export function getPaymentMethod(order) {
  return order?.payment_method || order?.paymentMethod || 'tap';
}

export function getPaymentStatus(order) {
  return order?.paymentStatus || 'Pending';
}

export function getPaymentReference(order) {
  return (
    order?.paymentReference ||
    order?.paymentDetails?.reference?.payment ||
    order?.paymentDetails?.reference?.transaction ||
    order?.paymentDetails?.id ||
    'N/A'
  );
}

export function getOrderStatus(order) {
  return order?.status || 'Pending';
}

export function getInvoiceNumber(order, prefix = 'INV') {
  return `${prefix}-${padNumericString(getOrderNumber(order), 6)}`;
}

export function getOrderNumberLabel(order, prefix = '#') {
  return `${prefix}${padNumericString(getOrderNumber(order), 6)}`;
}

export function getInvoiceStatus(order) {
  const paymentStatus = getPaymentStatus(order);
  if (paymentStatus === 'Paid') return 'Paid';
  if (paymentStatus === 'Failed') return 'Failed';
  return 'Open';
}

export function getOrderTotal(order) {
  return Number(order?.total || 0);
}

export function formatAddress(shipping) {
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
}

export function buildCustomerSummaries(orders) {
  const map = new Map();

  orders.forEach((order) => {
    const email = getCustomerEmail(order);
    const phone = getCustomerPhone(order);
    const key = (email && email !== 'N/A')
      ? `email:${email.toLowerCase()}`
      : (phone && phone !== 'N/A')
        ? `phone:${phone}`
        : `order:${order.id}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        key,
        name: getCustomerName(order),
        email,
        phone,
        totalSpend: getOrderTotal(order),
        orders: [order],
        latestDate: order?.createdAt
      });
      return;
    }

    existing.totalSpend += getOrderTotal(order);
    existing.orders.push(order);
    if (toDateMs(order?.createdAt) > toDateMs(existing.latestDate)) {
      existing.latestDate = order?.createdAt;
      existing.name = getCustomerName(order) || existing.name;
      existing.email = email !== 'N/A' ? email : existing.email;
      existing.phone = phone !== 'N/A' ? phone : existing.phone;
    }
  });

  return Array.from(map.values()).sort((a, b) => b.totalSpend - a.totalSpend);
}
