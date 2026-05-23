import"./index-DDbAoouI.js";const t=`
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
`;export{t as I};
