import { fetchGeoCurrency } from '../services/backendApi.js';
import {
  countryFromCurrency,
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
  if (!cc || !CHECKOUT_COUNTRY_CODES.includes(cc)) return DEFAULT_DISPLAY_CURRENCY;
  const mapped = currencyFromCountry(cc);
  return SUPPORTED_CODES.includes(mapped) ? mapped : DEFAULT_DISPLAY_CURRENCY;
}

/**
 * Resolve country + currency as a matched pair from geo IP hint.
 * @param {{ countryCode?: string | null, currency?: string | null }} geo
 */
export function resolveGeoPreferences(geo = {}) {
  const detectedCountry = String(geo.countryCode || '').trim().toUpperCase();
  const detectedCurrency = String(geo.currency || '').trim().toUpperCase();

  if (CHECKOUT_COUNTRY_CODES.includes(detectedCountry)) {
    return {
      country: detectedCountry,
      currency: currencyForCheckoutCountry(detectedCountry),
    };
  }

  const inferredCountry = countryFromCurrency(detectedCurrency);
  if (inferredCountry && CHECKOUT_COUNTRY_CODES.includes(inferredCountry)) {
    return {
      country: inferredCountry,
      currency: detectedCurrency,
    };
  }

  return {
    country: DEFAULT_CHECKOUT_COUNTRY,
    currency: DEFAULT_DISPLAY_CURRENCY,
  };
}

/**
 * Align a partially saved country/currency pair.
 * @param {string | null} savedCountry
 * @param {string | null} savedCurrency
 */
export function alignGeoPreferencePair(savedCountry, savedCurrency) {
  if (savedCountry && savedCurrency) {
    return { country: savedCountry, currency: savedCurrency };
  }
  if (savedCountry) {
    return { country: savedCountry, currency: currencyForCheckoutCountry(savedCountry) };
  }
  if (savedCurrency) {
    const fromCurrency = countryFromCurrency(savedCurrency);
    if (fromCurrency && CHECKOUT_COUNTRY_CODES.includes(fromCurrency)) {
      return { country: fromCurrency, currency: savedCurrency };
    }
  }
  return null;
}

/**
 * Detect visitor country/currency from IP (once) unless already saved manually.
 * @returns {Promise<{ country: string, currency: string, applied: boolean }>}
 */
export async function bootstrapGeoPreferences() {
  const savedCountry = readStoredCountry();
  const savedCurrency = readStoredCurrency();

  if (savedCountry && savedCurrency) {
    const countryForCurrency = countryFromCurrency(savedCurrency);
    if (
      countryForCurrency &&
      CHECKOUT_COUNTRY_CODES.includes(countryForCurrency) &&
      countryForCurrency !== savedCountry
    ) {
      try {
        localStorage.setItem(CHECKOUT_COUNTRY_STORAGE_KEY, countryForCurrency);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(
        new CustomEvent('ez-checkout-country-change', { detail: { country: countryForCurrency } })
      );
      return { country: countryForCurrency, currency: savedCurrency, applied: true };
    }
    return { country: savedCountry, currency: savedCurrency, applied: false };
  }

  let geo = {};
  try {
    geo = await fetchGeoCurrency();
  } catch {
    /* use defaults */
  }

  const resolved = resolveGeoPreferences(geo);
  const aligned = alignGeoPreferencePair(savedCountry, savedCurrency);
  const country = aligned?.country || resolved.country;
  const currency = aligned?.currency || resolved.currency;

  const shouldWriteCountry = !savedCountry || savedCountry !== country;
  const shouldWriteCurrency = !savedCurrency || savedCurrency !== currency;

  if (shouldWriteCountry) {
    try {
      localStorage.setItem(CHECKOUT_COUNTRY_STORAGE_KEY, country);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent('ez-checkout-country-change', { detail: { country } })
    );
  }

  if (shouldWriteCurrency) {
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
    applied: shouldWriteCountry || shouldWriteCurrency,
  };
}
