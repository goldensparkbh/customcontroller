import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CHECKOUT_COUNTRY_CODES, getCheckoutPhonePrefix } from '../lib/checkoutCountries.js';
import {
  bootstrapGeoPreferences,
  DEFAULT_CHECKOUT_COUNTRY,
  getSessionCountry,
  setSessionCountry,
} from '../lib/geoPreferences.js';

const CheckoutCountryContext = createContext(null);

export function CheckoutCountryProvider({ children }) {
  const [country, setCountryState] = useState(getSessionCountry);

  useEffect(() => {
    bootstrapGeoPreferences().then((result) => {
      if (result?.country) {
        setCountryState(result.country);
      }
    });
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
    setSessionCountry(next);
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
