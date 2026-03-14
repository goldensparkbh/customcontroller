const createRowId = () => `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const toFiniteNumber = (value, fallback = 0) => {
    const normalized = typeof value === 'string' && value.trim() === '' ? Number.NaN : Number(value);
    return Number.isFinite(normalized) ? normalized : fallback;
};

export const createInventoryEntry = (overrides = {}) => ({
    id: overrides.id || createRowId(),
    purchasePrice: overrides.purchasePrice ?? 0,
    sellPrice: overrides.sellPrice ?? overrides.price ?? 0,
    quantity: overrides.quantity ?? 0,
    isActive: Boolean(overrides.isActive)
});

const sanitizeInventoryEntry = (entry = {}) => ({
    id: entry.id || createRowId(),
    purchasePrice: toFiniteNumber(entry.purchasePrice, 0),
    sellPrice: toFiniteNumber(entry.sellPrice ?? entry.price, 0),
    quantity: toFiniteNumber(entry.quantity, 0),
    isActive: Boolean(entry.isActive)
});

export const normalizeInventoryEntries = (entries, fallback = {}) => {
    const rawEntries = Array.isArray(entries) && entries.length > 0
        ? entries
        : [createInventoryEntry({
            purchasePrice: fallback.purchasePrice ?? 0,
            sellPrice: fallback.sellPrice ?? fallback.price ?? 0,
            quantity: fallback.quantity ?? 0,
            isActive: true
        })];

    const sanitized = rawEntries.map((entry) => sanitizeInventoryEntry(entry));
    const activeIndex = sanitized.findIndex((entry) => entry.isActive);
    const normalizedActiveIndex = activeIndex >= 0 ? activeIndex : 0;

    return sanitized.map((entry, index) => ({
        ...entry,
        isActive: index === normalizedActiveIndex
    }));
};

export const hydrateInventoryFormEntries = (record = {}) => (
    normalizeInventoryEntries(record.inventoryDetails, {
        purchasePrice: record.purchasePrice ?? 0,
        sellPrice: record.sellPrice ?? record.price ?? 0,
        quantity: record.quantity ?? 0
    }).map((entry) => ({
        ...entry,
        purchasePrice: String(entry.purchasePrice ?? 0),
        sellPrice: String(entry.sellPrice ?? 0),
        quantity: String(entry.quantity ?? 0)
    }))
);

export const buildInventoryPayload = (entries, fallback = {}) => {
    const inventoryDetails = normalizeInventoryEntries(entries, fallback);
    const activeInventory = inventoryDetails.find((entry) => entry.isActive) || inventoryDetails[0];

    return {
        inventoryDetails,
        activeInventory,
        purchasePrice: activeInventory?.purchasePrice ?? 0,
        sellPrice: activeInventory?.sellPrice ?? 0,
        price: activeInventory?.sellPrice ?? 0,
        quantity: activeInventory?.quantity ?? 0
    };
};

export const getActiveInventoryEntry = (record = {}) => (
    buildInventoryPayload(record.inventoryDetails, {
        purchasePrice: record.purchasePrice ?? 0,
        sellPrice: record.sellPrice ?? record.price ?? 0,
        quantity: record.quantity ?? 0
    }).activeInventory
);

export const formatInventoryMoney = (value, currency = 'BHD') => (
    `${toFiniteNumber(value, 0).toFixed(2)} ${currency}`
);
