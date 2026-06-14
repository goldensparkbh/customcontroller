import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CHECKOUT_COUNTRY_CODES, getCheckoutPhonePrefix } from '../lib/checkoutCountries.js';

const CheckoutCountryContext = createContext(null);

export function CheckoutCountryProvider({ children }) {
  const [country, setCountry] = useState(() => {
    try {
      return localStorage.getItem('ez_checkout_country') || 'BH';
    } catch {
      return 'BH';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ez_checkout_country', country);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent('ez-checkout-country-change', { detail: { country } }));
  }, [country]);

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
