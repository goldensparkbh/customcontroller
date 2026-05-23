"use strict";

const BASE_CURRENCY = "BHD";
const SUPPORTED_CODES = ["BHD", "USD", "EUR", "GBP", "SAR", "AED", "KWD", "OMR", "QAR"];

const EURO_ZONE = new Set([
  "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL",
  "PT", "SI", "SK", "AD", "MC", "SM", "VA", "ME", "XK"
]);

/** @type {Record<string, string>} */
const COUNTRY_TO_CURRENCY = {
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

function currencyFromCountry(countryCode) {
  const cc = String(countryCode || "").trim().toUpperCase();
  const mapped = COUNTRY_TO_CURRENCY[cc];
  if (mapped && SUPPORTED_CODES.includes(mapped)) return mapped;
  return BASE_CURRENCY;
}

module.exports = { BASE_CURRENCY, SUPPORTED_CODES, currencyFromCountry };
