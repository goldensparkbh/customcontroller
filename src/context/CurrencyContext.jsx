import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchExchangeRates, fetchGeoCurrency } from '../services/backendApi.js';
import {
  BASE_CURRENCY,
  formatConvertedAmount,
  getCurrencyMeta,
  SUPPORTED_CODES
} from '../lib/currencies.js';

const STORAGE_KEY = 'ez_currency';

const CurrencyContext = createContext(null);

function readLang() {
  return localStorage.getItem('ez_lang') || 'ar';
}

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_CODES.includes(saved) ? saved : BASE_CURRENCY;
  });
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
    let alive = true;
    (async () => {
      try {
        const hasSaved = Boolean(localStorage.getItem(STORAGE_KEY));
        const ratesPayload = await fetchExchangeRates();
        const geo = hasSaved ? null : await fetchGeoCurrency();
        if (!alive) return;

        setRates(ratesPayload.rates || { BHD: 1 });
        setRatesMeta({
          loading: false,
          source: ratesPayload.source || '',
          stale: Boolean(ratesPayload.stale),
          fetchedAt: ratesPayload.fetchedAt || ''
        });

        if (geo?.currency && SUPPORTED_CODES.includes(geo.currency) && !hasSaved) {
          setCurrencyState(geo.currency);
          localStorage.setItem(STORAGE_KEY, geo.currency);
        }

        window.dispatchEvent(
          new CustomEvent('ez-currency-change', { detail: { currency: localStorage.getItem(STORAGE_KEY) || BASE_CURRENCY } })
        );
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
    const next = SUPPORTED_CODES.includes(code) ? code : BASE_CURRENCY;
    setCurrencyState(next);
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent('ez-currency-change', { detail: { currency: next } }));
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
