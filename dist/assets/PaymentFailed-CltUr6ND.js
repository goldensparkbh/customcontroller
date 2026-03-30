import{r as t,j as a}from"./index-Ct2aqlA6.js";const n=`
<canvas id="bgCanvas"></canvas>
<div class="top-nav" style="display:none;"></div>
<div class="mobile-nav-overlay" id="mobileNavOverlay"></div>
<aside class="mobile-nav-drawer" id="mobileNavDrawer" aria-hidden="true">
  <a class="mobile-nav-link" href="/#premadeSection" data-i18n="navPremade">تصاميم جاهزة</a>
  <a class="mobile-nav-link mobile-nav-cta" href="/configurator" data-i18n="navBuildCta">صمّم ذراعك الآن</a>
  <button class="mobile-nav-link mobile-nav-lang" id="mobileLangToggle" type="button">EN</button>
  <button class="mobile-nav-link mobile-nav-theme" id="mobileThemeToggle" type="button">فاتح</button>
</aside>
<div class="page-content" style="padding-top:80px; display:flex; justify-content:center;">
  <div class="card" style="max-width:480px; width:100%; text-align:center;">
    <div class="card-title" data-i18n="paymentFailedTitle" style="color: #ff4d4d;">فشل الدفع</div>
    <div style="font-size:3rem; margin:20px 0;">❌</div>
    <div id="failMessage" data-i18n="paymentFailedMessage" style="font-size:1rem; margin:10px 0;">لم تكتمل عملية الدفع بنجاح.</div>
    <div id="redirectMsg" data-i18n="redirectingCart" style="font-size:0.9rem; margin-top:10px; opacity:0.7;">جاري التحويل للسلة...</div>
  </div>
</div>
`,l=`
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

  // --- FAILURE LOGIC ---
  // Redirect to cart after 5 seconds
  setTimeout(() => {
    window.location.href = "/cart";
  }, 5000);
`;function i(){return t.useEffect(()=>{const e=document.createElement("script");return e.textContent=l,document.body.appendChild(e),()=>{document.body.contains(e)&&document.body.removeChild(e)}},[]),a.jsx("div",{dangerouslySetInnerHTML:{__html:n}})}export{i as default};
