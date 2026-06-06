"use strict";

const { currencyFromCountry, SUPPORTED_CODES, BASE_CURRENCY } = require("./currencies.cjs");

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.trim()) return cf.trim();
  const doClientIp = req.headers["do-connecting-ip"];
  if (typeof doClientIp === "string" && doClientIp.trim()) return doClientIp.trim();
  return req.socket?.remoteAddress || "";
}

function isPrivateIp(ip) {
  const s = String(ip || "");
  return (
    !s ||
    s === "::1" ||
    s.startsWith("127.") ||
    s.startsWith("10.") ||
    s.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(s)
  );
}

async function lookupCountryCode(ip) {
  if (isPrivateIp(ip)) return null;
  try {
    const url = `https://ipwho.is/${encodeURIComponent(ip)}?fields=country_code,success`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || json.success === false) return null;
    return String(json.country_code || "").trim().toUpperCase() || null;
  } catch (err) {
    console.warn("[geo-currency]", err.message || err);
    return null;
  }
}

async function suggestCurrencyForRequest(req) {
  const countryCode = await lookupCountryCode(getClientIp(req));
  const currency = currencyFromCountry(countryCode);
  return {
    countryCode,
    currency: SUPPORTED_CODES.includes(currency) ? currency : BASE_CURRENCY
  };
}

module.exports = { getClientIp, suggestCurrencyForRequest, currencyFromCountry };
