import { i18n } from '../i18n.js';

function stripRequired(label) {
  return String(label || '').replace(/\s*\*+\s*$/u, '').trim();
}

function labelFor(lang, key, fallback) {
  const dict = i18n[lang] || i18n.en || {};
  return stripRequired(dict[key] || fallback);
}

function hasValue(raw) {
  return String(raw ?? '').trim().length > 0;
}

/** Pull Block / Road / House / Flat out of a single composed address string (legacy orders). */
function parseComposedAddressString(composed) {
  const text = String(composed || '').trim();
  if (!text) return { street: '', blockNumber: '', roadNumber: '', houseBuildingNumber: '', flat: '' };

  const take = (pattern) => {
    const m = text.match(pattern);
    return m ? String(m[1]).trim() : '';
  };

  const blockNumber = take(/\bBlock\s*[:#]?\s*([^,]+)/i);
  const roadNumber = take(/\bRoad\s*[:#]?\s*([^,]+)/i);
  const houseBuildingNumber = take(/\b(?:House\/Building|House|Building)\s*[:#]?\s*([^,]+)/i);
  const flat = take(/\bFlat\s*[:#]?\s*([^,]+)/i);

  let street = text;
  for (const pattern of [
    /\s*,?\s*Block\s*[:#]?\s*[^,]+/gi,
    /\s*,?\s*Road\s*[:#]?\s*[^,]+/gi,
    /\s*,?\s*(?:House\/Building|House|Building)\s*[:#]?\s*[^,]+/gi,
    /\s*,?\s*Flat\s*[:#]?\s*[^,]+/gi,
    /\s*,?\s*Unified Address\s*[^,]+/gi
  ]) {
    street = street.replace(pattern, '');
  }
  street = street.replace(/^[\s,]+|[\s,]+$/g, '').replace(/\s*,\s*/g, ', ').trim();

  return { street, blockNumber, roadNumber, houseBuildingNumber, flat };
}

/**
 * Labeled shipping address rows for admin (orders, invoices, customers).
 * @returns {{ key: string, label: string, value: string }[]}
 */
export function getShippingAddressFields(shipping, { lang = 'en' } = {}) {
  if (!shipping || typeof shipping !== 'object') {
    return [];
  }

  const method = String(shipping.method || '').trim().toLowerCase();
  if (method === 'pickup') {
    return [
      {
        key: 'method',
        label: labelFor(lang, 'shippingMethodLabel', 'Shipping method'),
        value: labelFor(lang, 'shippingBahrainPickup', 'Store pickup')
      }
    ];
  }

  /** @type {{ key: string, label: string, value: string }[]} */
  const fields = [];
  const push = (key, label, raw) => {
    if (!hasValue(raw)) return;
    fields.push({ key, label, value: String(raw).trim() });
  };

  push('country', labelFor(lang, 'countryLabel', 'Country'), shipping.country);
  push('city', labelFor(lang, 'cityLabel', 'City'), shipping.city);
  push('state', labelFor(lang, 'stateLabel', 'State / Province'), shipping.state);
  push(
    'saudiUnifiedAddress',
    labelFor(lang, 'saudiUnifiedAddressLabel', 'Saudi unified address'),
    shipping.saudiUnifiedAddress
  );

  const addressLine = String(shipping.addressLine || '').trim();
  const addressMain = String(shipping.address || '').trim();
  let blockNumber = shipping.blockNumber;
  let roadNumber = shipping.roadNumber;
  let houseBuildingNumber = shipping.houseBuildingNumber;
  let flat = shipping.flat;
  let streetLine = addressLine;

  const hasStructured =
    hasValue(blockNumber) || hasValue(roadNumber) || hasValue(houseBuildingNumber) || hasValue(flat);

  if (!hasStructured && addressMain && /Block|Road|House|Building|Flat/i.test(addressMain)) {
    const parsed = parseComposedAddressString(addressMain);
    blockNumber = blockNumber || parsed.blockNumber;
    roadNumber = roadNumber || parsed.roadNumber;
    houseBuildingNumber = houseBuildingNumber || parsed.houseBuildingNumber;
    flat = flat || parsed.flat;
    if (!streetLine && parsed.street) streetLine = parsed.street;
  } else if (!streetLine && addressMain && !hasStructured) {
    streetLine = addressMain;
  } else if (!streetLine && addressMain && hasStructured && addressMain !== addressLine) {
    const parsed = parseComposedAddressString(addressMain);
    if (parsed.street) streetLine = parsed.street;
  }

  push('addressLine', labelFor(lang, 'addressLine1Label', 'Address'), streetLine);
  push('blockNumber', labelFor(lang, 'blockNumberLabel', 'Block'), blockNumber);
  push('roadNumber', labelFor(lang, 'roadNumberLabel', 'Road'), roadNumber);
  push(
    'houseBuildingNumber',
    labelFor(lang, 'houseBuildingNumberLabel', 'House / Building'),
    houseBuildingNumber
  );
  push('flat', labelFor(lang, 'flatLabel', 'Flat'), flat);

  if (!fields.length) {
    return [{ key: 'empty', label: labelFor(lang, 'addressLine1Label', 'Address'), value: 'N/A' }];
  }

  return fields;
}

/** Plain multi-line text (emails, exports). */
export function formatAddress(shipping, { lang = 'en' } = {}) {
  const fields = getShippingAddressFields(shipping, { lang });
  if (!fields.length) return 'N/A';
  return fields.map((f) => `${f.label}: ${f.value}`).join('\n');
}
