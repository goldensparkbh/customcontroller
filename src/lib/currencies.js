/** Store prices are always in BHD; display currencies use live rates from the server. */

export const BASE_CURRENCY = "BHD";

export const CURRENCIES = [
  { code: "BHD", labelEn: "Bahraini Dinar", labelAr: "دينار بحريني", symbol: "BHD", decimals: 3 },
  { code: "USD", labelEn: "US Dollar", labelAr: "دولار أمريكي", symbol: "$", decimals: 2 },
  { code: "EUR", labelEn: "Euro", labelAr: "يورو", symbol: "€", decimals: 2 },
  { code: "GBP", labelEn: "British Pound", labelAr: "جنيه إسترليني", symbol: "£", decimals: 2 },
  { code: "SAR", labelEn: "Saudi Riyal", labelAr: "ريال سعودي", symbol: "SAR", decimals: 2 },
  { code: "AED", labelEn: "UAE Dirham", labelAr: "درهم إماراتي", symbol: "AED", decimals: 2 },
  { code: "KWD", labelEn: "Kuwaiti Dinar", labelAr: "دينار كويتي", symbol: "KWD", decimals: 3 },
  { code: "OMR", labelEn: "Omani Rial", labelAr: "ريال عماني", symbol: "OMR", decimals: 3 },
  { code: "QAR", labelEn: "Qatari Riyal", labelAr: "ريال قطري", symbol: "QAR", decimals: 2 }
];

const EURO_ZONE = new Set([
  "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL",
  "PT", "SI", "SK", "AD", "MC", "SM", "VA", "ME", "XK"
]);

/** @type {Record<string, string>} */
export const COUNTRY_TO_CURRENCY = {
  BH: "BHD",
  US: "USD",
  GB: "GBP",
  SA: "SAR",
  AE: "AED",
  KW: "KWD",
  OM: "OMR",
  QA: "QAR"
};

for (const cc of EURO_ZONE) COUNTRY_TO_CURRENCY[cc] = "EUR";

export const SUPPORTED_CODES = CURRENCIES.map((c) => c.code);

export function getCurrencyMeta(code) {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
}

export function currencyFromCountry(countryCode) {
  const cc = String(countryCode || "").trim().toUpperCase();
  const mapped = COUNTRY_TO_CURRENCY[cc];
  if (mapped && SUPPORTED_CODES.includes(mapped)) return mapped;
  return BASE_CURRENCY;
}

export function formatConvertedAmount(amount, code, { lang = "en" } = {}) {
  const meta = getCurrencyMeta(code);
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  const text = safe.toFixed(meta.decimals);
  if (code === "USD" || code === "EUR" || code === "GBP") {
    return `${meta.symbol}${text}`;
  }
  return lang === "ar" ? `${text} ${meta.symbol}` : `${meta.symbol} ${text}`;
}
