import{r as t,j as a}from"./index-CXQpt9Us.js";const n=`
  <canvas id="bgCanvas"></canvas>
<div class="page-content" style="padding-top:80px; display:flex; justify-content:center;">
  <div class="track-shell">
    <div class="track-header">
      <div class="track-title" id="trackTitle" data-i18n="trackTitle">تتبع الطلب</div>
      <div class="track-status" id="trackStatus"></div>
    </div>
    <div id="stepsList" class="steps-list"></div>
    <div id="orderDetails" class="order-details"></div>
    <div id="orderItems" class="order-items"></div>
  </div>
</div>

<style>
  .track-shell {
    width: 100%;
    max-width: 1100px;
    background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));
    padding: 18px 22px 24px;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 18px;
    color: #fff;
  }
  .track-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .track-title {
    font-size: 1.35rem;
    font-weight: 800;
  }
  .track-status {
    font-size: 0.95rem;
    opacity: 0.9;
  }
  .order-details {
    margin-top: 14px;
    padding: 12px 14px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
    font-size: 0.95rem;
  }
  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .detail-label {
    opacity: 0.7;
    font-size: 0.85rem;
  }
  .detail-value {
    font-weight: 700;
  }
  .order-items {
    margin-top: 16px;
    padding: 12px 14px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
  }
  .order-items h3 {
    margin: 0 0 10px;
    font-size: 1rem;
    font-weight: 800;
  }
  .item-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 8px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    font-size: 0.95rem;
  }
  .item-row:last-child { border-bottom: none; }
  .item-label { opacity: 0.85; }
  .item-qty,
  .item-price { text-align: right; }
  .steps-list {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
    margin-top: 24px;
    position: relative;
  }
  .step-card {
    background: none;
    border: none;
    padding: 10px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    position: relative;
    min-height: 260px;
    flex: 1 1 220px;
  }
  .step-line { display: none; }
  .step-icon-wrap {
    width: 130px;
    height: 130px;
    border-radius: 0;
    background: none;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: none;
    position: relative;
  }
  .step-icon-wrap::before {
    content: "";
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 2px solid rgba(124,252,0,0.0);
    pointer-events: none;
  }
  .step-icon-wrap.has-line::after {
    content: "";
    position: absolute;
    top: 50%;
    left: calc(100% + 8px);
    width: 70px;
    height: 2px;
    background: linear-gradient(90deg, rgba(124,252,0,0.7), rgba(124,252,0,0.15));
    transform: translateY(-50%);
  }
  .step-icon {
    width: 120px;
    height: 120px;
    object-fit: contain;
    filter: none;
    transition: filter 0.2s ease, opacity 0.2s ease;
  }
  .step-card.pending .step-icon {
    filter: grayscale(1) brightness(0.7);
    opacity: 0.7;
  }
  .step-card.step-current .step-icon {
    filter: grayscale(1) brightness(0.8);
    opacity: 0.9;
  }
  .step-card.step-current .step-icon-wrap::before {
    border-color: rgba(124,252,0,0.7);
    animation: pulseRing 1.6s ease-in-out infinite;
  }
  .step-title {
    font-weight: 800;
    text-align: center;
    font-size: 1.1rem;
  }
  .step-status {
    font-size: 1rem;
    opacity: 0.85;
    text-align: center;
  }
  @media (max-width: 900px) {
    .steps-list { justify-content: center; }
  }
  @media (max-width: 640px) {
    .steps-list { gap: 18px; }
    .step-icon-wrap.has-line::after { width: 50px; }
  }
  @keyframes pulseRing {
    0% { transform: scale(0.95); opacity: 0.6; }
    50% { transform: scale(1.05); opacity: 1; }
    100% { transform: scale(0.95); opacity: 0.6; }
  }
</style>
`,s=`
let navLang = localStorage.getItem("ez_lang") || "ar";
const i18n = window.__EZ_I18N__ || {};
const navLangToggle = document.getElementById("langToggle");
const mobileLangToggle = document.getElementById("mobileLangToggle");
const themeToggle = document.getElementById("themeToggle");
const mobileThemeToggle = document.getElementById("mobileThemeToggle");
const navMenuBtn = document.querySelector(".nav-menu-btn");
const mobileNavOverlay = document.getElementById("mobileNavOverlay");
const mobileNavDrawer = document.getElementById("mobileNavDrawer");

function t(key) {
  return (i18n[navLang] && i18n[navLang][key]) || key;
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });
}

function updateNavLangLabel() {
  const label = navLang === "ar" ? "EN" : "AR";
  if (navLangToggle) navLangToggle.textContent = label;
  if (mobileLangToggle) mobileLangToggle.textContent = label;
  applyTranslations();
  updateThemeLabel();
}

function toggleNavLang() {
  navLang = navLang === "ar" ? "en" : "ar";
  localStorage.setItem("ez_lang", navLang);
  document.documentElement.lang = navLang;
  document.documentElement.dir = navLang === "ar" ? "rtl" : "ltr";
  updateNavLangLabel();
}

updateNavLangLabel();
if (navLangToggle) navLangToggle.addEventListener("click", toggleNavLang);
if (mobileLangToggle) mobileLangToggle.addEventListener("click", toggleNavLang);

let currentTheme = localStorage.getItem("ez_theme") || "dark";

function applyTheme() {
  document.body.classList.toggle("theme-light", currentTheme === "light");
}

function themeLabel() {
  const lightLabel = t("themeLight");
  const darkLabel = t("themeDark");
  return currentTheme === "dark" ? lightLabel : darkLabel;
}

function updateThemeLabel() {
  const label = themeLabel();
  if (themeToggle) themeToggle.textContent = label;
  if (mobileThemeToggle) mobileThemeToggle.textContent = label;
}

function toggleTheme() {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem("ez_theme", currentTheme);
  applyTheme();
  updateThemeLabel();
}

if (themeToggle) themeToggle.addEventListener("click", toggleTheme);
if (mobileThemeToggle) mobileThemeToggle.addEventListener("click", toggleTheme);
applyTheme();
updateThemeLabel();

function setMobileNavOpen(isOpen) {
  if (!mobileNavOverlay || !mobileNavDrawer) return;
  mobileNavOverlay.classList.toggle("open", isOpen);
  mobileNavDrawer.classList.toggle("open", isOpen);
  document.body.classList.toggle("mobile-nav-open", isOpen);
  if (navMenuBtn) {
    navMenuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }
}

if (navMenuBtn && mobileNavOverlay && mobileNavDrawer) {
  navMenuBtn.addEventListener("click", () => {
    const isOpen = mobileNavDrawer.classList.contains("open");
    setMobileNavOpen(!isOpen);
  });
  mobileNavOverlay.addEventListener("click", () => setMobileNavOpen(false));
  mobileNavDrawer.querySelectorAll("a, button").forEach((el) => {
    el.addEventListener("click", () => setMobileNavOpen(false));
  });
}

const statusEl = document.getElementById("trackStatus");
const stepsListEl = document.getElementById("stepsList");
const orderDetailsEl = document.getElementById("orderDetails");
const orderItemsEl = document.getElementById("orderItems");

function setStatus(msg) {
  statusEl.textContent = msg;
}

function addStep(label, value, done, icon, hasLine, current) {
  const card = document.createElement("div");
  card.className = "step-card" + (done ? " step-done" : " pending") + (current ? " step-current" : "");
  const iconWrap = document.createElement("div");
  iconWrap.className = "step-icon-wrap" + (hasLine ? " has-line" : "");
  const img = document.createElement("img");
  img.className = "step-icon";
  img.src = icon;
  img.alt = label;
  img.onerror = () => {
    img.style.display = "none";
    console.warn("Icon failed to load:", icon);
  };
  iconWrap.appendChild(img);
  const title = document.createElement("div");
  title.className = "step-title";
  title.textContent = label;
  const status = document.createElement("div");
  status.className = "step-status";
  status.textContent = value;
  card.appendChild(iconWrap);
  card.appendChild(title);
  card.appendChild(status);
  if (hasLine) {
    const line = document.createElement("div");
    line.className = "step-line";
    card.appendChild(line);
  }
  stepsListEl.appendChild(card);
}

function getOrderId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("order") || params.get("order_id") || params.get("id");
}

async function fetchJson(url, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(label + " HTTP " + res.status);
  return res.json();
}

async function load() {
  const orderId = getOrderId();
  if (!orderId) {
    setStatus(t("trackNoOrderId"));
    return;
  }
  setStatus(t("trackLoadingPrefix") + orderId + " …");
  stepsListEl.innerHTML = "";
  orderDetailsEl.innerHTML = "";
  orderItemsEl.innerHTML = "";

  try {
    const so = await fetchJson("/zoho/inventory/v1/salesorders/" + encodeURIComponent(orderId), "salesorder");
    const salesorder = so.salesorder || {};
    const soId = salesorder.salesorder_id ? String(salesorder.salesorder_id) : String(orderId);
    const soNumber = salesorder.salesorder_number || "";
    const soStatus = salesorder.status || "Unknown";
    const soDate = salesorder.date || salesorder.created_time || "";
    const soTotal = typeof salesorder.total === "number" ? salesorder.total.toFixed(2) : "";
    const currency = salesorder.currency_code || "BHD";
    // render order details
    const details = [
      { label: t("trackOrderIdLabel"), value: soNumber || soId },
      { label: t("trackStatusLabel"), value: soStatus },
      { label: t("trackDateLabel"), value: soDate },
      { label: t("trackTotalLabel"), value: soTotal ? currency + " " + soTotal : "" }
    ];
    orderDetailsEl.innerHTML = "";
    details.forEach(d => {
      const item = document.createElement("div");
      item.className = "detail-item";
      const l = document.createElement("div");
      l.className = "detail-label";
      l.textContent = d.label;
      const v = document.createElement("div");
      v.className = "detail-value";
      v.textContent = d.value || "—";
      item.appendChild(l);
      item.appendChild(v);
      orderDetailsEl.appendChild(item);
    });

    // render line items
    const items = Array.isArray(salesorder.line_items) ? salesorder.line_items : [];
    const itemsWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = t("trackSalesOrderTitle");
    itemsWrap.appendChild(title);
    if (!items.length) {
      const empty = document.createElement("div");
      empty.textContent = t("trackNoItems");
      empty.style.opacity = "0.8";
      itemsWrap.appendChild(empty);
    } else {
      items.forEach(li => {
        const row = document.createElement("div");
        row.className = "item-row";
        const name = document.createElement("div");
        name.className = "item-label";
        name.textContent = li.name || li.item_name || "Item";
        const qty = document.createElement("div");
        qty.className = "item-qty";
        qty.textContent = t("trackQtyLabel") + " " + (li.quantity || 0);
        const price = document.createElement("div");
        price.className = "item-price";
        const rate = typeof li.rate === "number" ? li.rate.toFixed(2) : "";
        price.textContent = rate ? (li.currency_code || currency || "BHD") + " " + rate : "";
        row.appendChild(name);
        row.appendChild(qty);
        row.appendChild(price);
        itemsWrap.appendChild(row);
      });
    }
    orderItemsEl.appendChild(itemsWrap);
    const assetBase = window.location.origin;
    const version = "v1";
    const stepIcons = {
      order: assetBase + "/assets/track/order.png?" + version,
      process: assetBase + "/assets/track/process.png?" + version,
      ontheway: assetBase + "/assets/track/ontheway.png?" + version,
      delivered: assetBase + "/assets/track/delivered.png?" + version
    };
    const orderDone = true;

    // Packages (scoped to this sales order)
    let packages = [];
    try {
      const pkg = await fetchJson("/zoho/inventory/v1/packages?salesorder_id=" + encodeURIComponent(orderId) + "&per_page=200", "packages");
      packages = (pkg.packages || []).filter(p => {
        const pid = p.salesorder_id != null ? String(p.salesorder_id) : "";
        const pnum = p.salesorder_number || "";
        return (pid && pid === soId) || (soNumber && pnum === soNumber);
      });
    } catch (e) {
      // ignore
    }
    const pkgSummary = packages.length ? "" : "";
    const processingDone = packages.length > 0;

    // Shipments (scoped to this sales order)
    let shipments = [];
    try {
      const ship = await fetchJson("/zoho/inventory/v1/shipmentorders?salesorder_id=" + encodeURIComponent(orderId) + "&per_page=200", "shipments");
      shipments = (ship.shipmentorders || []).filter(s => {
        const sid = s.salesorder_id != null ? String(s.salesorder_id) : "";
        const snum = s.salesorder_number || "";
        return (sid && sid === soId) || (soNumber && snum === soNumber);
      });
    } catch (e) {
      // ignore
    }
    const onTheWayDone = shipments.length > 0;

    // Delivered (check shipment delivery_status or package delivery_status/status)
    const deliveredFromShipments = shipments.filter(sh => {
      const d = (sh.delivery_status || sh.status || "").toLowerCase();
      return d.includes("delivered");
    });
    const deliveredFromPackages = packages.filter(p => {
      const d = (p.delivery_status || p.status || "").toLowerCase();
      return d.includes("delivered");
    });
    const deliveredCount = deliveredFromShipments.length || deliveredFromPackages.length;
    const deliveredDone = deliveredCount > 0;

    // Decide current step (last done, unless delivered is done)
    const stepsData = [
      { label: t("trackOrderReceived"), value: "", done: orderDone, icon: stepIcons.order },
      { label: t("trackOrderProcessing"), value: "", done: processingDone, icon: stepIcons.process },
      { label: t("trackOnTheWay"), value: "", done: onTheWayDone, icon: stepIcons.ontheway },
      { label: t("trackDelivered"), value: "", done: deliveredDone, icon: stepIcons.delivered }
    ];

    let currentIndex = -1;
    if (!deliveredDone) {
      for (let i = stepsData.length - 1; i >= 0; i--) {
        if (stepsData[i].done) {
          currentIndex = i;
          break;
        }
      }
    }

    stepsListEl.innerHTML = "";
    stepsData.forEach((step, idx) => {
      const isCurrent = idx === currentIndex;
      const hasLine = idx !== stepsData.length - 1;
      addStep(step.label, step.value, step.done, step.icon, hasLine, isCurrent);
    });

    setStatus(t("trackLoaded"));
  } catch (err) {
    console.error(err);
    setStatus(t("trackFailedPrefix") + err.message);
  }
}

load();
`;function o(){return t.useEffect(()=>{const e=document.createElement("script");return e.textContent=s,document.body.appendChild(e),()=>{document.body.removeChild(e)}},[]),a.jsx("div",{dangerouslySetInnerHTML:{__html:n}})}export{o as default};
