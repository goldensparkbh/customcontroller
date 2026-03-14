import { doc, runTransaction } from 'firebase/firestore';

const DEFAULT_COUNTER_STARTS = {
    inventory: 100000,
    orders: 500000
};

const extractDigits = (value) => String(value ?? '').replace(/\D/g, '');

export const normalizeNumericString = (value, fallback = '') => {
    const digits = extractDigits(value);
    return digits || fallback;
};

export const padNumericString = (value, minLength = 6) => {
    const digits = normalizeNumericString(value);
    if (!digits) return '';
    return digits.padStart(minLength, '0');
};

export const getStableNumericFallback = (input, offset = 100000) => {
    const text = String(input || '');
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
        hash = ((hash * 31) + text.charCodeAt(index)) % 900000;
    }
    return String(offset + hash);
};

export const getInventoryItemNumber = (record = {}) => (
    normalizeNumericString(record.itemNumber || record.inventoryNumber || record.recordNumber) ||
    getStableNumericFallback(record.id || record.documentId || record.name || 'inventory')
);

export const getBarcodeValue = (record = {}) => (
    normalizeNumericString(record.barcode) || getInventoryItemNumber(record)
);

export const getOrderNumber = (record = {}) => (
    normalizeNumericString(record.orderNumber || record.recordNumber) ||
    getStableNumericFallback(record.id || record.paymentReference || 'order', DEFAULT_COUNTER_STARTS.orders)
);

export const allocateSequentialNumber = async (db, counterKey, startAt = DEFAULT_COUNTER_STARTS.inventory) => {
    const counterRef = doc(db, 'system_counters', counterKey);
    const nextValue = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(counterRef);
        const currentValue = snapshot.exists() ? Number(snapshot.data()?.current || startAt - 1) : startAt - 1;
        const safeCurrent = Number.isFinite(currentValue) ? currentValue : startAt - 1;
        const next = safeCurrent + 1;
        transaction.set(counterRef, { current: next }, { merge: true });
        return next;
    });

    return String(nextValue);
};
