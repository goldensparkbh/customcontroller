import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CHECKOUT_COUNTRY_CODES, getCheckoutPhonePrefix } from '../lib/checkoutCountries.js';
import {
  bootstrapGeoPreferences,
  CHECKOUT_COUNTRY_STORAGE_KEY,
  DEFAULT_CHECKOUT_COUNTRY
} from '../lib/geoPreferences.js';

const CheckoutCountryContext = createContext(null);

function readInitialCountry() {
  try {
    const saved = localStorage.getItem(CHECKOUT_COUNTRY_STORAGE_KEY);
    return CHECKOUT_COUNTRY_CODES.includes(saved) ? saved : DEFAULT_CHECKOUT_COUNTRY;
  } catch {
    return DEFAULT_CHECKOUT_COUNTRY;
  }
}

export function CheckoutCountryProvider({ children }) {
  const [country, setCountryState] = useState(readInitialCountry);

  useEffect(() => {
    bootstrapGeoPreferences().then((result) => {
      if (result.country && result.country !== country) {
        setCountryState(result.country);
      }
    });
    // Run once on mount; geo only applies when prefs are not saved yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onExternalChange = (event) => {
      const next = event?.detail?.country;
      if (next && CHECKOUT_COUNTRY_CODES.includes(next)) {
        setCountryState(next);
      }
    };
    window.addEventListener('ez-checkout-country-change', onExternalChange);
    return () => window.removeEventListener('ez-checkout-country-change', onExternalChange);
  }, []);

  const setCountry = (code) => {
    const next = CHECKOUT_COUNTRY_CODES.includes(code) ? code : DEFAULT_CHECKOUT_COUNTRY;
    setCountryState(next);
    try {
      localStorage.setItem(CHECKOUT_COUNTRY_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent('ez-checkout-country-change', { detail: { country: next } }));
  };

  const value = useMemo(
    () => ({
      country,
      setCountry,
      phonePrefix: getCheckoutPhonePrefix(country),
      countries: CHECKOUT_COUNTRY_CODES
    }),
    [country]
  );

  return (
    <CheckoutCountryContext.Provider value={value}>
      {children}
    </CheckoutCountryContext.Provider>
  );
}

export function useCheckoutCountry() {
  const ctx = useContext(CheckoutCountryContext);
  if (!ctx) {
    throw new Error('useCheckoutCountry must be used within CheckoutCountryProvider');
  }
  return ctx;
}
