import { fetchGeoCurrency } from '../services/backendApi.js';
import {
  countryFromCurrency,
  currencyFromCountry,
  SUPPORTED_CODES
} from './currencies.js';
import { CHECKOUT_COUNTRY_CODES } from './checkoutCountries.js';

/** Fallback when IP/country cannot be resolved. */
export const DEFAULT_CHECKOUT_COUNTRY = 'SA';
export const DEFAULT_DISPLAY_CURRENCY = 'SAR';

/** In-memory session prefs (not persisted to localStorage). */
let sessionCountry = DEFAULT_CHECKOUT_COUNTRY;
let sessionCurrency = DEFAULT_DISPLAY_CURRENCY;
let geoDetectedThisSession = false;

export function getSessionCountry() {
  return sessionCountry;
}

export function getSessionCurrency() {
  return sessionCurrency;
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

function publishSessionPreferences() {
  window.dispatchEvent(
    new CustomEvent('ez-checkout-country-change', { detail: { country: sessionCountry } })
  );
  window.dispatchEvent(
    new CustomEvent('ez-currency-change', { detail: { currency: sessionCurrency } })
  );
}

export function setSessionCountry(countryCode) {
  const next = CHECKOUT_COUNTRY_CODES.includes(countryCode) ? countryCode : DEFAULT_CHECKOUT_COUNTRY;
  sessionCountry = next;
  window.dispatchEvent(
    new CustomEvent('ez-checkout-country-change', { detail: { country: next } })
  );
}

export function setSessionCurrency(currencyCode) {
  const next = SUPPORTED_CODES.includes(currencyCode) ? currencyCode : DEFAULT_DISPLAY_CURRENCY;
  sessionCurrency = next;
  window.dispatchEvent(
    new CustomEvent('ez-currency-change', { detail: { currency: next } })
  );
}

/**
 * Detect visitor country/currency from IP for this browser session only.
 * @param {{ force?: boolean }} [opts] — force re-detect (e.g. when opening configurator)
 * @returns {Promise<{ country: string, currency: string, applied: boolean }>}
 */
export async function bootstrapGeoPreferences({ force = false } = {}) {
  if (geoDetectedThisSession && !force) {
    return { country: sessionCountry, currency: sessionCurrency, applied: false };
  }

  let geo = {};
  try {
    geo = await fetchGeoCurrency();
  } catch {
    /* use defaults */
  }

  const resolved = resolveGeoPreferences(geo);
  sessionCountry = resolved.country;
  sessionCurrency = resolved.currency;
  geoDetectedThisSession = true;
  publishSessionPreferences();

  return {
    country: sessionCountry,
    currency: sessionCurrency,
    applied: true,
  };
}
