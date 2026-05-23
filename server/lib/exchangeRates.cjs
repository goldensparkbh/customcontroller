"use strict";

const SUPPORTED = ["BHD", "USD", "SAR", "AED", "KWD", "OMR", "QAR"];
const CACHE_MS = Number(process.env.EXCHANGE_RATES_CACHE_MS || 6 * 60 * 60 * 1000);

/** @type {{ at: number, base: string, rates: Record<string, number>, source: string } | null} */
let cache = null;

async function fetchRatesFromApi() {
  const url = String(process.env.EXCHANGE_RATES_URL || "https://open.er-api.com/v6/latest/BHD").trim();
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`exchange_rates_http_${res.status}`);
  const json = await res.json();

  const base = String(json.base_code || json.base || "BHD").toUpperCase();
  const raw = json.conversion_rates || json.rates || {};
  /** @type {Record<string, number>} */
  const rates = { BHD: 1 };

  for (const code of SUPPORTED) {
    if (code === base) {
      rates[code] = 1;
      continue;
    }
    const v = Number(raw[code]);
    if (Number.isFinite(v) && v > 0) rates[code] = v;
  }

  if (Object.keys(rates).length < 2) {
    throw new Error("exchange_rates_incomplete");
  }

  return {
    base,
    rates,
    source: "open.er-api.com",
    fetchedAt: new Date().toISOString()
  };
}

async function getExchangeRates() {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return {
      base: cache.base,
      rates: cache.rates,
      source: cache.source,
      fetchedAt: cache.fetchedAt
    };
  }

  try {
    const fresh = await fetchRatesFromApi();
    cache = { at: now, ...fresh };
    return fresh;
  } catch (err) {
    console.error("[exchange-rates]", err.message || err);
    if (cache) {
      return {
        base: cache.base,
        rates: cache.rates,
        source: cache.source,
        fetchedAt: cache.fetchedAt,
        stale: true
      };
    }
    return {
      base: "BHD",
      rates: { BHD: 1, USD: 2.65, SAR: 9.95, AED: 9.73, KWD: 0.81, OMR: 1.02, QAR: 9.63 },
      source: "fallback",
      fetchedAt: new Date().toISOString(),
      stale: true
    };
  }
}

module.exports = { getExchangeRates, SUPPORTED };
