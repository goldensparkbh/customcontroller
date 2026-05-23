import { BASE_CURRENCY, formatConvertedAmount } from './currencies.js';

/**
 * Format a BHD amount in the visitor's selected currency.
 * Works in React (via CurrencyProvider) and in legacy inline scripts (via window.__EZ_CURRENCY__).
 */
export function formatMoneyFromBhd(bhdAmount, options = {}) {
  const n = Number(bhdAmount);
  const safe = Number.isFinite(n) ? n : 0;

  if (typeof window !== 'undefined' && window.__EZ_CURRENCY__?.format) {
    return window.__EZ_CURRENCY__.format(safe);
  }

  const lang =
    options.lang ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('ez_lang') : null) ||
    'ar';

  return formatConvertedAmount(safe, BASE_CURRENCY, { lang });
}

/** Injected into legacy page scripts (OrderSummary, TrackOrder, etc.). */
export const INLINE_FORMAT_MONEY_FN = `
function formatEzMoney(bhdAmount) {
  var n = Number(bhdAmount);
  if (!isFinite(n)) n = 0;
  if (window.__EZ_CURRENCY__ && typeof window.__EZ_CURRENCY__.format === "function") {
    return window.__EZ_CURRENCY__.format(n);
  }
  return "BHD " + n.toFixed(3);
}
window.addEventListener("ez-currency-change", function () {
  document.querySelectorAll("[data-bhd-price]").forEach(function (el) {
    var raw = el.getAttribute("data-bhd-price");
    if (raw == null || raw === "") return;
    el.textContent = formatEzMoney(Number(raw));
  });
});
`;
