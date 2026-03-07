import React, { useEffect } from 'react';

const cartMarkup = `


<canvas id="bgCanvas"></canvas>
 TOP NAV 
<div class="top-nav">
<div class="nav-logo">
<a class="nav-left" href="/">
<span class="nav-logo-mark" role="img" aria-label="Custom Controller"></span>
<div class="nav-page-title" data-i18n="cartTitle">سلة المشتريات</div>
</a>

</div>
<button class="nav-menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNavDrawer">
<span></span>
<span></span>
<span></span>
</button>
<div class="nav-right">
<a class="nav-link" href="/#premadeSection" data-i18n="navPremade">تصاميم جاهزة</a>
<a class="nav-link" href="/#contactSection" data-i18n="navContact">تواصل معنا</a>
<a class="nav-cta" href="/configurator" data-i18n="navBuildCta">صمّم ذراعك الآن</a>
<button class="nav-link nav-lang" id="langToggle" type="button">EN</button>
<button class="nav-link nav-theme" id="themeToggle" type="button">فاتح</button>
</div>
<div class="nav-summary">
<div class="nav-amount-block">
<div class="nav-amount-label" data-i18n="totalLabel">الإجمالي</div>
<div class="nav-amount-value" id="navTotal">د.ب 0.00</div>
</div>
<button class="checkout-nav-btn" data-i18n="checkoutCta" id="navCheckoutBtn">إتمام الشراء</button>
</div>
</div>
<div class="mobile-nav-overlay" id="mobileNavOverlay"></div>
<aside class="mobile-nav-drawer" id="mobileNavDrawer" aria-hidden="true">
<a class="mobile-nav-link" href="/#premadeSection" data-i18n="navPremade">تصاميم جاهزة</a>
<a class="mobile-nav-link" href="/#contactSection" data-i18n="navContact">تواصل معنا</a>
<a class="mobile-nav-link mobile-nav-cta" href="/configurator" data-i18n="navBuildCta">صمّم ذراعك الآن</a>
<button class="mobile-nav-link mobile-nav-lang" id="mobileLangToggle" type="button">EN</button>
<button class="mobile-nav-link mobile-nav-theme" id="mobileThemeToggle" type="button">فاتح</button>
</aside>
 PAGE CONTENT 
<div class="page-content">
<div class="cart-layout">
<!-- LEFT: CART ITEMS -->
<div class="cart-main-card">
<div class="card-title" data-i18n="cartTitle">سلة المشتريات</div>
<div class="cart-empty" data-i18n="cartEmpty" id="cartEmpty">
          السلة فارغة حاليًا. يمكنك تخصيص متحكم جديد من صفحة التخصيص.
        </div>
<div class="cart-items-list" id="cartItems"></div>
</div>
<!-- RIGHT: SUMMARY -->
<div class="cart-summary-card">
<div class="card-title" data-i18n="summaryTitle">الملخص</div>
<div class="summary-row">
<div data-i18n="itemsCountLabel">عدد القطع</div>
<div id="summaryItemsCount">0</div>
</div>
<div class="summary-row">
<div data-i18n="subtotalLabel">الإجمالي الفرعي</div>
<div id="summarySubtotal">د.ب 0.00</div>
</div>
<hr class="summary-hr"/>
<div class="summary-row">
<div data-i18n="shippingLabel">الشحن</div>
<div><small data-i18n="shippingNote">سيتم تحديده لاحقًا</small></div>
</div>
<div class="summary-row total">
<div data-i18n="totalLabelBold">الإجمالي</div>
<div id="summaryTotal">د.ب 0.00</div>
</div>
<button class="summary-checkout-btn" data-i18n="checkoutCta" id="checkoutBtn">إتمام الشراء</button>
</div>
</div>
</div>
<style>
.cart-controller-preview-dual {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  justify-content: center;
}
.preview-box {
  flex: 1;
  max-width: 200px;
  background: #141829;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  transition: transform 0.3s ease;
}
.preview-box:hover {
  transform: translateY(-4px);
  border-color: var(--accent1);
}
.preview-box img {
  width: 100%;
  height: auto;
  display: block;
}
.preview-label {
  font-size: 0.65rem;
  color: var(--color-text-muted);
  text-align: center;
  padding: 4px 0;
  background: rgba(0, 0, 0, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
@media (max-width: 600px) {
  .cart-controller-preview-dual {
    gap: 8px;
  }
}
</style>


`;
const cartScript = `


    const CART_KEY = "ezCart";

    // ---------- I18N ----------
    const i18n = window.__EZ_I18N__ || {};

    let currentLang = localStorage.getItem("ez_lang") || "ar";
    const navLangToggle = document.getElementById("langToggle");
    const mobileLangToggle = document.getElementById("mobileLangToggle");
    const themeToggle = document.getElementById("themeToggle");
    const mobileThemeToggle = document.getElementById("mobileThemeToggle");
    const navMenuBtn = document.querySelector(".nav-menu-btn");
    const mobileNavOverlay = document.getElementById("mobileNavOverlay");
    const mobileNavDrawer = document.getElementById("mobileNavDrawer");

    function t(key) {
      return (i18n[currentLang] && i18n[currentLang][key]) || key;
    }

    function getPartLabel(partId) {
      const dict = i18n[currentLang].parts || {};
      return dict[partId] || partId;
    }

    function applyLanguage() {
      document.documentElement.lang = currentLang;
      document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";

      document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        el.textContent = t(key);
      });

      renderCart();
      updateNavLangLabel();
      updateThemeLabel();
    }

    function updateNavLangLabel() {
      const label = currentLang === "ar" ? "EN" : "AR";
      if (navLangToggle) navLangToggle.textContent = label;
      if (mobileLangToggle) mobileLangToggle.textContent = label;
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

    function toggleLanguage() {
      currentLang = currentLang === "ar" ? "en" : "ar";
      localStorage.setItem("ez_lang", currentLang);
      applyLanguage();
    }

    if (navLangToggle) {
      navLangToggle.addEventListener("click", toggleLanguage);
    }

    if (mobileLangToggle) {
      mobileLangToggle.addEventListener("click", toggleLanguage);
    }

    if (themeToggle) {
      themeToggle.addEventListener("click", toggleTheme);
    }

    if (mobileThemeToggle) {
      mobileThemeToggle.addEventListener("click", toggleTheme);
    }

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

    applyTheme();
    updateThemeLabel();

    function formatMoney(value) {
      const prefix = i18n[currentLang].currencyPrefix || "";
      return prefix + value.toFixed(2);
    }

    // Safely decode and inject SVG strings from base64
    function renderPreview(container, data) {
      if (!data || !data.startsWith("data:image/svg+xml")) {
        container.innerHTML = '<div style="padding:20px; text-align:center; opacity:0.3;">?</div>';
        return;
      }
      try {
        const base64Code = data.split(",")[1];
        const svgMarkup = decodeURIComponent(escape(atob(base64Code)));
        container.innerHTML = svgMarkup;
      } catch (err) {
        console.error("SVG Render Error:", err);
        container.innerHTML = '<div style="padding:20px; text-align:center; color:red;">!</div>';
      }
    }

    // ---------- CART CORE ----------

    function loadCart() {
      try {
        const raw = localStorage.getItem(CART_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function saveCart(items) {
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(items));
      } catch { }
    }

    const TRANSPARENT_HEXES = new Set([
      "#ededed",
      "#d43838",
      "#2448b5",
      "#68d78b",
      "#4e2b8c",
      "#8c3b2f",
      "#e3e3e3"
    ]);
    const TRANSPARENT_TINT_OPACITY = 0.55;

    // masks as in configurator (front view only – for thumbnail)
    const THUMB_PARTS = [
      { id: "shell", mask: "/assets/masks/leftShell.png" },
      { id: "shell", mask: "/assets/masks/rightShell.png" },
      { id: "trimpiece", mask: "/assets/masks/centerBody.png" },
      { id: "stickL", mask: "/assets/masks/stickL.png" },
      { id: "stickR", mask: "/assets/masks/stickR.png" },
      { id: "faceButtons", mask: "/assets/masks/faceButtons.png" },
      { id: "touchpad", mask: "/assets/masks/touchpad.png" },
      { id: "bumpers", mask: "/assets/masks/bumperL.png" },
      { id: "bumpers", mask: "/assets/masks/bumperR.png" },
      { id: "psButton", mask: "/assets/masks/psButton.png" },
      { id: "share", mask: "/assets/masks/share.png" },
      { id: "options", mask: "/assets/masks/options.png" }
    ];

    // order of parts to display in the details list
    const ORDERED_PART_IDS = [
      "shell",
      "trimpiece",
      "faceButtons",
      "stickL",
      "stickR",
      "touchpad",
      "share",
      "options",
      "psButton",
      "bumpers",
      "backShellMain",
      "backHandles",
      "backTriggers"
    ];

    const cartItemsContainer = document.getElementById("cartItems");
    const cartEmptyEl = document.getElementById("cartEmpty");
    const navTotalEl = document.getElementById("navTotal");
    const summaryItemsCountEl = document.getElementById("summaryItemsCount");
    const summarySubtotalEl = document.getElementById("summarySubtotal");
    const summaryTotalEl = document.getElementById("summaryTotal");
    const checkoutBtn = document.getElementById("checkoutBtn");
    const navCheckoutBtn = document.getElementById("navCheckoutBtn");

    let cartItems = loadCart().map(item => ({
      ...item,
      unitPrice: typeof item.unitPrice === "number" ? item.unitPrice : (typeof item.total === "number" ? item.total : 0),
      quantity: typeof item.quantity === "number" ? item.quantity : 1
    }));

    function computeCartTotals() {
      let total = 0;
      let count = 0;
      for (const item of cartItems) {
        count += item.quantity;
        total += item.unitPrice * item.quantity;
      }
      return { total, count };
    }

    // build thumbnail of controller with same colors as configurator
    function buildThumb(container, config) {
      container.innerHTML = "";
      const tc = document.createElement("div");
      tc.className = "thumb-controller";

      const base = document.createElement("div");
      base.className = "thumb-base";
      
      // Dynamic base image depending on transparency (Front view)
      const partsToCheck = ["shell", "trimpiece", "touchpad"];
      const anyTransparentFront = partsToCheck.some(id => {
        const val = config[id];
        const hex = typeof val === "string" ? val : (val && val.hex);
        return hex && TRANSPARENT_HEXES.has(hex.toLowerCase());
      });
      
      const baseSrc = anyTransparentFront ? "/assets/controller_t.png" : "/assets/controller.png";
      tc.style.setProperty("--thumb-base-url", "url('" + baseSrc + "')");
      
      tc.appendChild(base);

      THUMB_PARTS.forEach(part => {
        const value = (config || {})[part.id];
        if (!value) return;

        const hex = typeof value === "string" ? value : value.hex;
        if (!hex) return;

        const layer = document.createElement("div");
        layer.className = "thumb-layer";
        layer.dataset.partId = part.id;
        layer.style.setProperty("--mask-url", "url('" + part.mask + "')");
        layer.style.setProperty("--tint", hex);

        if (TRANSPARENT_HEXES.has(hex.toLowerCase())) {
          layer.style.setProperty("--tint-opacity", String(TRANSPARENT_TINT_OPACITY));
        } else {
          layer.style.setProperty("--tint-opacity", "1");
        }
        tc.appendChild(layer);
      });

      container.appendChild(tc);
    }

    function renderCart() {
      cartItemsContainer.innerHTML = "";

      if (!cartItems.length) {
        cartEmptyEl.style.display = "block";
        cartEmptyEl.textContent = t("cartEmpty");
      } else {
        cartEmptyEl.style.display = "none";
      }

      cartItems.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "cart-item";
        card.dataset.index = index;

        const header = document.createElement("div");
        header.className = "cart-item-header";

        const nameEl = document.createElement("div");
        nameEl.className = "cart-item-name";
        nameEl.textContent = item.name || t("productName");

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "cart-item-remove";
        removeBtn.dataset.action = "remove";
        removeBtn.textContent = t("itemRemove");

        header.appendChild(nameEl);
        header.appendChild(removeBtn);

        const previewCol = document.createElement("div");
        previewCol.className = "cart-controller-preview-dual";

        if (item.previewFront && item.previewBack) {
          // New high-fidelity dual view
          const boxFront = document.createElement("div");
          boxFront.className = "preview-box";
          renderPreview(boxFront, item.previewFront);
          const labelFront = document.createElement("div");
          labelFront.className = "preview-label";
          labelFront.textContent = currentLang === "ar" ? "\u0627\u0644\u0623\u0645\u0627\u0645" : "Front";
          boxFront.appendChild(labelFront);

          const boxBack = document.createElement("div");
          boxBack.className = "preview-box";
          renderPreview(boxBack, item.previewBack);
          const labelBack = document.createElement("div");
          labelBack.className = "preview-label";
          labelBack.textContent = currentLang === "ar" ? "\u0627\u0644\u062e\u0644\u0641" : "Back";
          boxBack.appendChild(labelBack);

          previewCol.appendChild(boxFront);
          previewCol.appendChild(boxBack);
        } else if (item.preview) {
          // Legacy or fallback preview
          const box = document.createElement("div");
          box.className = "preview-box";
          box.style.maxWidth = "280px";
          const img = document.createElement("img");
          img.src = item.preview;
          box.appendChild(img);
          previewCol.appendChild(box);
        } else {
          // Fallback buildThumb for items without static previews
          const thumbContainer = document.createElement("div");
          thumbContainer.className = "cart-controller-preview";
          buildThumb(thumbContainer, item.config || {});
          previewCol.appendChild(thumbContainer);
        }

        const detailsCol = document.createElement("div");
        detailsCol.className = "cart-item-details";

        const partsHeading = document.createElement("div");
        partsHeading.className = "cart-item-parts-heading";
        partsHeading.textContent = t("itemDetailsHeading");
        detailsCol.appendChild(partsHeading);

        const ul = document.createElement("ul");
        ul.className = "cart-item-parts-list";

        const config = item.config || {};

        // show each configured part as: colored circle + part label (+ optional color name if available)
        ORDERED_PART_IDS.forEach(partId => {
          const values = [
            { val: config[partId], type: "color" },
            { val: config[partId + "_opt"], type: "option" }
          ].filter(item => item.val);

          values.forEach(({ val: value, type }) => {
            let hex = "";
            let colorName = "";

            if (typeof value === "string") {
              hex = value;
            } else if (value && typeof value === "object") {
              hex = value.hex || "";
              if (currentLang === "ar") {
                colorName = value.name_ar || "";
              } else {
                colorName = value.name_en || "";
              }
            }

            if (!hex) return;

            const li = document.createElement("li");
            li.className = "cart-color-line";

            const dot = document.createElement("span");
            dot.className = "cart-color-dot";
            dot.style.backgroundColor = hex;

            const text = document.createElement("span");
            text.className = "cart-color-text";

            const partLabel = getPartLabel(partId);
            const typeLabel = type === "option" ? (currentLang === "ar" ? " [\u062a\u0637\u0648\u064a\u0631]" : " [Upgrade]") : "";
            
            text.textContent = colorName
              ? partLabel + typeLabel + ": " + colorName
              : partLabel + typeLabel;

            li.appendChild(dot);
            li.appendChild(text);
            ul.appendChild(li);
          });
        });

        detailsCol.appendChild(ul);

        const footer = document.createElement("div");
        footer.className = "cart-item-footer";

        const qtyControls = document.createElement("div");
        qtyControls.className = "cart-qty-controls";

        const decBtn = document.createElement("button");
        decBtn.type = "button";
        decBtn.className = "cart-qty-btn";
        decBtn.dataset.action = "dec";
        decBtn.textContent = "-";

        const qtyValue = document.createElement("div");
        qtyValue.className = "cart-qty-value";
        qtyValue.textContent = item.quantity;

        const incBtn = document.createElement("button");
        incBtn.type = "button";
        incBtn.className = "cart-qty-btn";
        incBtn.dataset.action = "inc";
        incBtn.textContent = "+";

        qtyControls.appendChild(decBtn);
        qtyControls.appendChild(qtyValue);
        qtyControls.appendChild(incBtn);

        const priceBlock = document.createElement("div");
        priceBlock.className = "cart-item-price-block";

        const priceLabel = document.createElement("div");
        priceLabel.className = "cart-item-price-label";
        priceLabel.textContent = t("itemLineTotalLabel");

        const priceValue = document.createElement("div");
        priceValue.className = "cart-item-price-value";
        const lineTotal = item.unitPrice * item.quantity;
        priceValue.textContent = formatMoney(lineTotal);

        priceBlock.appendChild(priceLabel);
        priceBlock.appendChild(priceValue);

        footer.appendChild(qtyControls);
        footer.appendChild(priceBlock);

        detailsCol.appendChild(footer);

        card.appendChild(header);
        card.appendChild(previewCol);
        card.appendChild(detailsCol);

        cartItemsContainer.appendChild(card);
      });

      const { total, count } = computeCartTotals();
      navTotalEl.textContent = formatMoney(total);
      summaryItemsCountEl.textContent = count;
      summarySubtotalEl.textContent = formatMoney(total);
      summaryTotalEl.textContent = formatMoney(total);
    }

    // Quantity / remove handlers via delegation
    cartItemsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const card = btn.closest(".cart-item");
      if (!card) return;

      const index = parseInt(card.dataset.index, 10);
      if (Number.isNaN(index) || index < 0 || index >= cartItems.length) return;

      const action = btn.dataset.action;
      if (action === "inc") {
        cartItems[index].quantity += 1;
      } else if (action === "dec") {
        if (cartItems[index].quantity > 1) {
          cartItems[index].quantity -= 1;
        } else {
          cartItems.splice(index, 1);
        }
      } else if (action === "remove") {
        cartItems.splice(index, 1);
      }

      saveCart(cartItems);
      renderCart();
    });

    function goToCheckout() {
      if (!cartItems.length) {
        alert(t("alertEmptyForCheckout"));
        return;
      }
      window.location.href = "/checkout";
    }

    checkoutBtn.addEventListener("click", goToCheckout);
    navCheckoutBtn.addEventListener("click", goToCheckout);

    // initial
    applyLanguage();
  

`;

function CartPage() {
  useEffect(() => {
    const scriptEl = document.createElement('script');
    scriptEl.textContent = cartScript;
    document.body.appendChild(scriptEl);
    return () => {
      document.body.removeChild(scriptEl);
    };
  }, []);

  return (
    <div className="cart-page">
      <div dangerouslySetInnerHTML={{ __html: cartMarkup }} />
    </div>
  );
}

export default CartPage;
