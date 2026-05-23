"use strict";

const BASE_CURRENCY = "BHD";
const SUPPORTED_CODES = ["BHD", "USD", "SAR", "AED", "KWD", "OMR", "QAR"];

/** @type {Record<string, string>} */
const COUNTRY_TO_CURRENCY = {
  BH: "BHD",
  US: "USD",
  SA: "SAR",
  AE: "AED",
  KW: "KWD",
  OM: "OMR",
  QA: "QAR"
};

function currencyFromCountry(countryCode) {
  const cc = String(countryCode || "").trim().toUpperCase();
  const mapped = COUNTRY_TO_CURRENCY[cc];
  if (mapped && SUPPORTED_CODES.includes(mapped)) return mapped;
  return BASE_CURRENCY;
}

module.exports = { BASE_CURRENCY, SUPPORTED_CODES, currencyFromCountry };
