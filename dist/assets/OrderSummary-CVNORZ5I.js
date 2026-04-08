import{r as t,j as a}from"./index-CrMbv1A5.js";const n=`
<canvas id="bgCanvas"></canvas>
<div class="top-nav" style="display:none;"></div>
<div class="mobile-nav-overlay" id="mobileNavOverlay"></div>
<aside class="mobile-nav-drawer" id="mobileNavDrawer" aria-hidden="true">
  <a class="mobile-nav-link" href="/#premadeSection" data-i18n="navPremade">Premade Designs</a>
  <a class="mobile-nav-link mobile-nav-cta" href="/configurator" data-i18n="navBuildCta">Build Yours Now</a>
  <button class="mobile-nav-link mobile-nav-lang" id="mobileLangToggle" type="button">EN</button>
  <button class="mobile-nav-link mobile-nav-theme" id="mobileThemeToggle" type="button">Light</button>
</aside>
<div class="page-content" style="padding-top:80px; display:flex; justify-content:center;">
  <div class="card" style="max-width:640px; width:100%;">
    <div class="card-title" data-i18n="orderSummaryTitle">Order Summary</div>
    <div id="orderStatus" style="margin-bottom:8px;"></div>
    <div id="orderItems"></div>
    <div id="orderTotals" style="margin-top:10px; font-weight:700;"></div>
  </div>
</div>
`,l=`
  function getLineItemTotal(item) {
    const qty = item.quantity || 1;
    const unit = item.unitPrice != null ? item.unitPrice : (item.total != null ? item.total : 0);
    return Number(unit) * qty;
  }

  function getDraftTotal(draft) {
    const cart = Array.isArray(draft && draft.cart) ? draft.cart : [];
    const subtotal = Number(draft && draft.subtotal) > 0
      ? Number(draft.subtotal)
      : cart.reduce((sum, item) => sum + getLineItemTotal(item), 0);
    const shippingCost = Number(draft && draft.shippingCost);
    return Number(draft && draft.total) > 0
      ? Number(draft.total)
      : subtotal + (Number.isFinite(shippingCost) && shippingCost > 0 ? shippingCost : 0);
  }

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

  function toggleNavLang() {
    navLang = navLang === "ar" ? "en" : "ar";
    localStorage.setItem("ez_lang", navLang);
    document.documentElement.lang = navLang;
    document.documentElement.dir = navLang === "ar" ? "rtl" : "ltr";
    updateNavLangLabel();
  }

  updateNavLangLabel();
  applyTheme();
  updateThemeLabel();
  applyTranslations();
  if (navLangToggle) navLangToggle.addEventListener("click", toggleNavLang);
  if (mobileLangToggle) mobileLangToggle.addEventListener("click", toggleNavLang);
  if (themeToggle) themeToggle.addEventListener("click", toggleTheme);
  if (mobileThemeToggle) mobileThemeToggle.addEventListener("click", toggleTheme);

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

  const resultRaw = localStorage.getItem("ezOrderResult");
  const draftRaw = localStorage.getItem("ezOrderDraft");
  const statusEl = document.getElementById("orderStatus");
  const itemsEl = document.getElementById("orderItems");
  const totalsEl = document.getElementById("orderTotals");

  if (!resultRaw || !draftRaw) {
    statusEl.textContent = t("orderStatusMissing");
    setTimeout(() => window.location.href = "/cart", 1200);
  } else {
    const draft = JSON.parse(draftRaw);
    const cart = Array.isArray(draft.cart) ? draft.cart : [];
    const total = getDraftTotal(draft);
    statusEl.innerHTML = t("orderStatusLabel") + " <strong>" + t("orderStatusConfirmed") + "</strong>";
    const list = document.createElement("ul");
    cart.forEach((item) => {
      const li = document.createElement("li");
      li.textContent =
        (item.name || t("orderItemFallback")) +
        " x " +
        (item.quantity || 1) +
        " - " +
        (draft.currencyPrefix || "BHD ") +
        getLineItemTotal(item).toFixed(2);
      list.appendChild(li);
    });
    itemsEl.appendChild(list);
    totalsEl.textContent = t("orderTotalLabel") + " " + (draft.currencyPrefix || "BHD ") + total.toFixed(2);
  }
`;function i(){return t.useEffect(()=>{const e=document.createElement("script");return e.textContent=l,document.body.appendChild(e),()=>document.body.removeChild(e)},[]),a.jsx("div",{dangerouslySetInnerHTML:{__html:n}})}export{i as default};
