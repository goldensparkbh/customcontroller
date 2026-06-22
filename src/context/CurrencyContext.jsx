import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchExchangeRates } from '../services/backendApi.js';
import {
  BASE_CURRENCY,
  formatConvertedAmount,
  getCurrencyMeta,
  SUPPORTED_CODES
} from '../lib/currencies.js';
import {
  bootstrapGeoPreferences,
  DEFAULT_DISPLAY_CURRENCY,
  getSessionCurrency,
  setSessionCurrency,
} from '../lib/geoPreferences.js';

const CurrencyContext = createContext(null);

function readLang() {
  return localStorage.getItem('ez_lang') || 'ar';
}

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(getSessionCurrency);
  const [rates, setRates] = useState({ BHD: 1 });
  const [ratesMeta, setRatesMeta] = useState({ loading: true, source: '', stale: false });
  const [lang, setLang] = useState(readLang);

  useEffect(() => {
    const onLang = () => setLang(readLang());
    window.addEventListener('ez-lang-change', onLang);
    window.addEventListener('storage', onLang);
    return () => {
      window.removeEventListener('ez-lang-change', onLang);
      window.removeEventListener('storage', onLang);
    };
  }, []);

  useEffect(() => {
    const onExternalChange = (event) => {
      const next = event?.detail?.currency;
      if (next && SUPPORTED_CODES.includes(next)) {
        setCurrencyState(next);
      }
    };
    window.addEventListener('ez-currency-change', onExternalChange);
    return () => window.removeEventListener('ez-currency-change', onExternalChange);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ratesPayload, geoResult] = await Promise.all([
          fetchExchangeRates(),
          bootstrapGeoPreferences()
        ]);
        if (!alive) return;

        setRates(ratesPayload.rates || { BHD: 1 });
        setRatesMeta({
          loading: false,
          source: ratesPayload.source || '',
          stale: Boolean(ratesPayload.stale),
          fetchedAt: ratesPayload.fetchedAt || ''
        });

        if (geoResult?.currency && SUPPORTED_CODES.includes(geoResult.currency)) {
          setCurrencyState(geoResult.currency);
        }
      } catch (err) {
        console.warn('[currency] bootstrap failed', err);
        if (alive) setRatesMeta((m) => ({ ...m, loading: false }));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const formatFromBhd = useCallback(
    (bhdAmount) => {
      const bhd = Number(bhdAmount);
      const safe = Number.isFinite(bhd) ? bhd : 0;
      const rate = Number(rates[currency]);
      const converted =
        currency === BASE_CURRENCY ? safe : Number.isFinite(rate) && rate > 0 ? safe * rate : safe;
      return formatConvertedAmount(converted, currency, { lang });
    },
    [currency, rates, lang]
  );

  const setCurrency = useCallback((code) => {
    const next = SUPPORTED_CODES.includes(code) ? code : DEFAULT_DISPLAY_CURRENCY;
    setCurrencyState(next);
    setSessionCurrency(next);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__EZ_CURRENCY__ = {
      code: currency,
      format: formatFromBhd,
      getMeta: () => getCurrencyMeta(currency)
    };
    window.dispatchEvent(new CustomEvent('ez-currency-change', { detail: { currency } }));
  }, [currency, formatFromBhd]);

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      rates,
      ratesLoading: ratesMeta.loading,
      ratesSource: ratesMeta.source,
      ratesStale: ratesMeta.stale,
      formatFromBhd,
      isBaseCurrency: currency === BASE_CURRENCY,
      chargeNote:
        currency !== BASE_CURRENCY
          ? lang === 'ar'
            ? 'سيتم تحصيل المبلغ بالدينار البحريني (BHD) عند الدفع.'
            : 'You will be charged in Bahraini Dinar (BHD) at checkout.'
          : ''
    }),
    [currency, setCurrency, rates, ratesMeta, formatFromBhd, lang]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return ctx;
}
