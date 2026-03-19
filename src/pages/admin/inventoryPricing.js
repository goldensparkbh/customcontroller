const createEntryId = () => `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const INVENTORY_REASON_OPTIONS = [
    { value: 'new_stock', label: 'New Stock' },
    { value: 'supplier_restock', label: 'Supplier Restock' },
    { value: 'returned_items', label: 'Returned Items' },
    { value: 'stock_correction', label: 'Stock Correction' },
    { value: 'manual_adjustment', label: 'Manual Adjustment' },
    { value: 'opening_balance', label: 'Opening Balance' },
    { value: 'order_allocation', label: 'Order Allocation' }
];

const REASON_LABELS = INVENTORY_REASON_OPTIONS.reduce((map, option) => {
    map[option.value] = option.label;
    return map;
}, {});

const toFiniteNumber = (value, fallback = 0) => {
    const normalized = typeof value === 'string' && value.trim() === '' ? Number.NaN : Number(value);
    return Number.isFinite(normalized) ? normalized : fallback;
};

const getTodayInputValue = () => new Date().toISOString().slice(0, 10);

const normalizeDateValue = (value) => {
    const raw = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const date = raw ? new Date(raw) : new Date();
    if (Number.isNaN(date.getTime())) return getTodayInputValue();
    return date.toISOString().slice(0, 10);
};

const isLegacyBatchRow = (entry = {}) => (
    Object.prototype.hasOwnProperty.call(entry, 'sellPrice') ||
    Object.prototype.hasOwnProperty.call(entry, 'purchasePrice') ||
    Object.prototype.hasOwnProperty.call(entry, 'isActive') ||
    Object.prototype.hasOwnProperty.call(entry, 'price')
);

export const createInventoryEntry = (overrides = {}) => ({
    id: overrides.id || createEntryId(),
    quantity: overrides.quantity ?? 0,
    date: normalizeDateValue(overrides.date),
    reason: overrides.reason || 'new_stock',
    source: overrides.source || 'manual',
    note: overrides.note || '',
    createdAt: overrides.createdAt || ''
});

const sanitizeInventoryEntry = (entry = {}) => ({
    id: entry.id || createEntryId(),
    quantity: toFiniteNumber(entry.quantity, 0),
    date: normalizeDateValue(entry.date),
    reason: REASON_LABELS[entry.reason] ? entry.reason : 'new_stock',
    source: entry.source || 'manual',
    note: String(entry.note || '').trim(),
    createdAt: entry.createdAt || ''
});

const createOpeningBalanceEntry = (fallback = {}) => {
    const quantity = toFiniteNumber(fallback.quantity, 0);
    if (!quantity) return [];

    return [createInventoryEntry({
        quantity,
        date: normalizeDateValue(fallback.date || fallback.updatedAt || fallback.createdAt),
        reason: 'opening_balance',
        source: 'migration',
        note: 'Migrated from legacy inventory'
    })];
};

export const normalizeInventoryEntries = (entries, fallback = {}) => {
    if (Array.isArray(entries) && entries.length > 0) {
        if (entries.some((entry) => isLegacyBatchRow(entry))) {
            return createOpeningBalanceEntry(fallback);
        }

        return entries.map((entry) => sanitizeInventoryEntry(entry));
    }

    return createOpeningBalanceEntry(fallback);
};

export const hydrateInventoryFormEntries = (record = {}) => (
    normalizeInventoryEntries(record.inventoryDetails, {
        quantity: record.quantity ?? 0,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    }).map((entry) => ({
        ...entry,
        quantity: String(entry.quantity ?? 0),
        date: normalizeDateValue(entry.date)
    }))
);

export const getInventoryQuantity = (entries, fallback = {}) => {
    const normalizedEntries = normalizeInventoryEntries(entries, fallback);
    return normalizedEntries.reduce((sum, entry) => sum + toFiniteNumber(entry.quantity, 0), 0);
};

export const buildInventoryPayload = (entries, pricing = {}, fallback = {}) => {
    const inventoryDetails = normalizeInventoryEntries(entries, fallback);
    const purchasePrice = toFiniteNumber(pricing.purchasePrice ?? fallback.purchasePrice, 0);
    const sellPrice = toFiniteNumber(pricing.sellPrice ?? pricing.price ?? fallback.sellPrice ?? fallback.price, 0);
    const quantity = inventoryDetails.reduce((sum, entry) => sum + toFiniteNumber(entry.quantity, 0), 0);

    return {
        inventoryDetails,
        purchasePrice,
        sellPrice,
        price: sellPrice,
        quantity
    };
};

export const formatInventoryMoney = (value, currency = 'BHD') => (
    `${toFiniteNumber(value, 0).toFixed(2)} ${currency}`
);

export const formatInventoryDate = (value) => {
    const normalized = normalizeDateValue(value);
    const date = new Date(`${normalized}T00:00:00`);
    return Number.isNaN(date.getTime()) ? normalized : date.toLocaleDateString();
};

export const getInventoryReasonLabel = (reason) => REASON_LABELS[reason] || 'Inventory Update';
