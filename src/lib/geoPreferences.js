import { fetchGeoCurrency } from '../services/backendApi.js';
import {
  BASE_CURRENCY,
  currencyFromCountry,
  SUPPORTED_CODES
} from './currencies.js';
import { CHECKOUT_COUNTRY_CODES } from './checkoutCountries.js';

export const CHECKOUT_COUNTRY_STORAGE_KEY = 'ez_checkout_country';
export const CURRENCY_STORAGE_KEY = 'ez_currency';

/** Fallback when IP/country cannot be resolved. */
export const DEFAULT_CHECKOUT_COUNTRY = 'SA';
export const DEFAULT_DISPLAY_CURRENCY = 'SAR';

function readStoredCountry() {
  try {
    const saved = localStorage.getItem(CHECKOUT_COUNTRY_STORAGE_KEY);
    return CHECKOUT_COUNTRY_CODES.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

function readStoredCurrency() {
  try {
    const saved = localStorage.getItem(CURRENCY_STORAGE_KEY);
    return SUPPORTED_CODES.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

/**
 * Pick display currency for a checkout country code.
 * @param {string | null | undefined} countryCode
 */
export function currencyForCheckoutCountry(countryCode) {
  const cc = String(countryCode || '').trim().toUpperCase();
  if (!cc) return DEFAULT_DISPLAY_CURRENCY;
  const mapped = currencyFromCountry(cc);
  if (mapped !== BASE_CURRENCY || cc === 'BH') return mapped;
  return DEFAULT_DISPLAY_CURRENCY;
}

/**
 * Resolve country + currency from geo IP hint, with SA/SAR defaults.
 * @param {{ countryCode?: string | null, currency?: string | null }} geo
 */
export function resolveGeoPreferences(geo = {}) {
  const detectedCountry = String(geo.countryCode || '').trim().toUpperCase();
  const detectedCurrency = String(geo.currency || '').trim().toUpperCase();

  const country = CHECKOUT_COUNTRY_CODES.includes(detectedCountry)
    ? detectedCountry
    : DEFAULT_CHECKOUT_COUNTRY;

  let currency = DEFAULT_DISPLAY_CURRENCY;
  if (detectedCurrency && SUPPORTED_CODES.includes(detectedCurrency)) {
    currency = detectedCurrency;
  } else if (CHECKOUT_COUNTRY_CODES.includes(detectedCountry)) {
    currency = currencyForCheckoutCountry(detectedCountry);
  }

  return { country, currency };
}

/**
 * Detect visitor country/currency from IP (once) unless already saved manually.
 * @returns {Promise<{ country: string, currency: string, applied: boolean }>}
 */
export async function bootstrapGeoPreferences() {
  const savedCountry = readStoredCountry();
  const savedCurrency = readStoredCurrency();
  if (savedCountry && savedCurrency) {
    return { country: savedCountry, currency: savedCurrency, applied: false };
  }

  let geo = {};
  try {
    geo = await fetchGeoCurrency();
  } catch {
    /* use defaults */
  }

  const resolved = resolveGeoPreferences(geo);
  const country = savedCountry || resolved.country;
  const currency = savedCurrency || resolved.currency;

  if (!savedCountry) {
    try {
      localStorage.setItem(CHECKOUT_COUNTRY_STORAGE_KEY, country);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent('ez-checkout-country-change', { detail: { country } })
    );
  }

  if (!savedCurrency) {
    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent('ez-currency-change', { detail: { currency } })
    );
  }

  return {
    country,
    currency,
    applied: !savedCountry || !savedCurrency
  };
}
