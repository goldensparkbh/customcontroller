import React, { useEffect } from 'react';

const checkoutMarkup = `
<canvas id="bgCanvas"></canvas>
<!-- TOP NAV -->
<div class="top-nav">
  <div class="nav-logo">
    <a class="nav-left" href="/">
      <span class="nav-logo-mark" role="img" aria-label="Custom Controller"></span>
      <div class="nav-page-title" data-i18n="checkoutTitle">إتمام الشراء</div>
    </a>
  </div>
  <button class="nav-menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNavDrawer">
    <span></span>
    <span></span>
    <span></span>
  </button>
  <div class="nav-right">
    <a class="nav-link" href="/#premadeSection" data-i18n="navPremade">تصاميم جاهزة</a>
    <a class="nav-cta" href="/configurator" data-i18n="navBuildCta">صمّم ذراعك الآن</a>
    <button class="nav-link nav-lang" id="langToggle" type="button">EN</button>
  </div>
  <div class="nav-summary">
    <div class="nav-amount-block">
      <div class="nav-amount-label" data-i18n="totalLabel">الإجمالي</div>
      <div class="nav-amount-value" id="navTotal">د.ب 0.00</div>
    </div>
  </div>
</div>

<div class="mobile-nav-overlay" id="mobileNavOverlay"></div>
<aside class="mobile-nav-drawer" id="mobileNavDrawer" aria-hidden="true">
  <a class="mobile-nav-link" href="/#premadeSection" data-i18n="navPremade">تصاميم جاهزة</a>
  <a class="mobile-nav-link mobile-nav-cta" href="/configurator" data-i18n="navBuildCta">صمّم ذراعك الآن</a>
  <button class="mobile-nav-link mobile-nav-lang" id="mobileLangToggle" type="button">EN</button>
</aside>

<!-- PAGE CONTENT -->
<div class="page-content">
  <div class="checkout-layout">
    <!-- LEFT: FORM -->
    <div class="card">
      <div class="card-title" data-i18n="formTitle">بيانات العميل والدفع</div>
      <form id="checkoutForm">
        <!-- Personal Info -->
        <div class="form-row">
          <div class="form-field">
            <label data-i18n="firstNameLabel" for="firstName">الاسم الأول *</label>
            <input id="firstName" name="firstName" required=""/>
          </div>
          <div class="form-field">
            <label data-i18n="lastNameLabel" for="lastName">اسم العائلة *</label>
            <input id="lastName" name="lastName" required=""/>
          </div>
        </div>
        <div class="form-row">
          <div class="phone-field-group">
            <div class="form-field main-phone-field">
              <label data-i18n="phoneLabel" for="phone">رقم الهاتف *</label>
              <input id="phone" name="phone" required="" type="tel" placeholder="XXXXXXXX" minlength="8" maxlength="15" pattern="[0-9]{8,15}" title="Phone number should be between 8 and 15 digits" />
            </div>
            <div class="form-field prefix-field">
              <label data-i18n="phonePrefixLabel">رمز الدولة *</label>
              <select id="phonePrefix" name="phonePrefix" required class="select-input">
                <option value="973">+973 (BH)</option>
                <option value="966">+966 (SA)</option>
                <option value="971">+971 (AE)</option>
                <option value="965">+965 (KW)</option>
                <option value="968">+968 (OM)</option>
                <option value="974">+974 (QA)</option>
                <option value="20">+20 (EG)</option>
                <option value="962">+962 (JO)</option>
              </select>
            </div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label data-i18n="emailLabel" for="email">البريد الإلكتروني (اختياري)</label>
            <input id="email" name="email" type="email"/>
          </div>
        </div>

        <!-- Country & Shipping Options -->
        <div class="form-row">
          <div class="form-field">
            <label data-i18n="countryLabel" for="country">الدولة *</label>
            <select id="country" name="country" required class="select-input">
              <!-- Options injected by JS -->
            </select>
          </div>
        </div>

        <!-- Bahrain Shipping Choices -->
        <div class="form-field" id="bhShippingOptions" style="display:none; margin-bottom: 20px;">
          <label data-i18n="shippingMethodLabel" style="margin-bottom: 10px; display: block;">طريقة الشحن</label>
          <div class="radio-group" style="display: flex; gap: 20px;">
            <label class="radio-option">
              <input type="radio" name="shippingType" value="delivery" checked />
              <span data-i18n="shippingBahrainDelivery">توصيل (2 د.ب)</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="shippingType" value="pickup" />
              <span data-i18n="shippingBahrainPickup">استلام من المتجر (مجاني)</span>
            </label>
          </div>
        </div>

        <!-- Address Section (Conditional) -->
        <div id="addressSection">
          <div class="form-row">
            <div class="form-field">
              <label data-i18n="cityLabel" for="city">رقم المجمع *</label>
              <input id="city" name="city" required placeholder="Block number" />
            </div>
            <div class="form-field">
              <label data-i18n="addressLine1Label" for="addressLine1">طريق / منزل *</label>
              <input id="addressLine1" name="addressLine1" required placeholder="Road and House num" />
            </div>
          </div>
        </div>

        <input type="hidden" name="shippingMethod" id="shippingMethod" value="delivery" />
        <input type="hidden" name="shippingCost" id="shippingCostInput" value="0" />
        <input type="hidden" name="paymentMethod" value="online" />

        <div class="terms-row">
          <input id="agree" required="" type="checkbox"/>
          <label data-i18n="termsText" for="agree">
            أقر بأن جميع بيانات التخصيص صحيحة، وأوافق على الشروط والأحكام وسياسة الاستبدال.
          </label>
        </div>
        <button class="place-order-btn" id="placeOrderBtn" type="submit">
          <span class="btn-text" data-i18n="placeOrderBtn">تأكيد الطلب</span>
          <span class="btn-loader" style="display:none;">
             <svg class="spinner" viewBox="0 0 50 50"><circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle></svg>
          </span>
        </button>
      </form>
    </div>

    <!-- RIGHT: ORDER SUMMARY -->
    <div class="card">
      <div class="card-title" data-i18n="summaryTitle">ملخص الطلب</div>
      <div data-i18n="summaryEmpty" id="summaryEmpty" style="font-size:0.85rem; opacity:0.8; margin-bottom:8px; display:none;">
        لا توجد عناصر في السلة. يرجى العودة إلى صفحة التخصيص.
      </div>
      <div class="summary-items-list" id="summaryItemsList"></div>
      <hr class="summary-hr"/>
      <div class="summary-row">
        <div data-i18n="itemsCountLabel">عدد القطع</div>
        <div id="summaryItemsCount">0</div>
      </div>
      <div class="summary-row">
        <div data-i18n="subtotalLabel">الإجمالي الفرعي</div>
        <div id="summarySubtotal">د.ب 0.00</div>
      </div>
      <div class="summary-row">
        <div data-i18n="shippingLabel">الشحن</div>
        <div id="summaryShippingCost">د.ب 0.00</div>
      </div>
      <div class="summary-row total">
        <div data-i18n="totalDueLabel">الإجمالي</div>
        <div id="summaryTotal">د.ب 0.00</div>
      </div>
    </div>
  </div>
</div>

<style>
  .phone-field-group {
    display: flex;
    gap: 12px;
    width: 100%;
  }
  .prefix-field { flex: 0 0 120px; }
  .main-phone-field { flex: 1; }
  
  .place-order-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .spinner {
    animation: rotate 2s linear infinite;
    width: 20px;
    height: 20px;
  }
  .spinner .path {
    stroke: currentColor;
    stroke-linecap: round;
    animation: dash 1.5s ease-in-out infinite;
  }
  
  /* Dual Preview Styling */
  .checkout-controller-preview-dual {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  .preview-box {
    flex: 1;
    max-width: 140px;
    background: #141829;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  .preview-box img {
    width: 100%;
    height: auto;
    display: block;
  }
  .preview-label {
    font-size: 0.55rem;
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
    padding: 2px 0;
    background: rgba(0, 0, 0, 0.4);
    text-transform: uppercase;
  }

  @keyframes rotate { 100% { transform: rotate(360deg); } }
  @keyframes dash {
    0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
    50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
    100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
  }
</style>
`;

const checkoutScript = `
    const CART_KEY = "ezCart";
    const i18n = window.__EZ_I18N__ || {};
    let currentLang = localStorage.getItem("ez_lang") || "ar";

    // Restricted Arab Countries List
    const arabCountries = ["BH", "SA", "AE", "KW", "OM", "QA", "EG", "JO"];

    function t(key) {
      return (i18n[currentLang] && i18n[currentLang][key]) || key;
    }

    function formatMoney(value) {
      const prefix = i18n[currentLang].currencyPrefix || "";
      return prefix + (Number(value) || 0).toFixed(2);
    }

    function renderPreview(container, data) {
      if (!data) {
        container.innerHTML = '<div style="padding:10px; text-align:center; opacity:0.3;">?</div>';
        return;
      }
      
      if (data.startsWith("data:image/png") || data.startsWith("data:image/jpeg")) {
        const img = document.createElement("img");
        img.src = data;
        img.style.width = "100%";
        img.style.height = "auto";
        img.style.display = "block";
        container.innerHTML = "";
        container.appendChild(img);
        return;
      }

      if (data.startsWith("data:image/svg+xml")) {
        try {
          const base64Code = data.split(",")[1];
          const svgMarkup = decodeURIComponent(escape(atob(base64Code)));
          container.innerHTML = svgMarkup;
        } catch (err) {
          console.error("SVG Render Error:", err);
          container.innerHTML = '<div style="padding:10px; text-align:center; color:red;">!</div>';
        }
        return;
      }

      container.innerHTML = '<div style="padding:10px; text-align:center; opacity:0.3;">?</div>';
    }

    // --- UI Update Function ---
    function updateShippingUI() {
        const countrySelect = document.getElementById("country");
        const country = countrySelect.value;
        const isBahrain = country === "BH";
        
        const bhOptions = document.getElementById("bhShippingOptions");
        const addressSection = document.getElementById("addressSection");
        const cityInput = document.getElementById("city");
        const addressInput = document.getElementById("addressLine1");

        // Show/Hide Bahrain Options
        bhOptions.style.display = isBahrain ? "block" : "none";

        let shippingCost = 0;
        let requiresAddress = true;

        const { count } = computeCartTotals();

        if (isBahrain) {
            const deliveryType = document.querySelector('input[name="shippingType"]:checked').value;
            if (deliveryType === "pickup") {
                shippingCost = 0;
                requiresAddress = false;
            } else {
                shippingCost = 2.00;
                requiresAddress = true;
            }
        } else {
            const pairs = Math.ceil(count / 2);
            shippingCost = pairs * 5.00;
            requiresAddress = true;
        }

        // Update Address Visibility & Requirements
        if (requiresAddress) {
            addressSection.style.display = "block";
            cityInput.setAttribute("required", "required");
            addressInput.setAttribute("required", "required");
        } else {
            addressSection.style.display = "none";
            cityInput.removeAttribute("required");
            addressInput.removeAttribute("required");
        }

        // Update Hidden Inputs
        document.getElementById("shippingCostInput").value = shippingCost;
        document.getElementById("shippingMethod").value = isBahrain ? document.querySelector('input[name="shippingType"]:checked').value : "international";

        // Update Summary
        document.getElementById("summaryShippingCost").textContent = formatMoney(shippingCost);
        
        const { total } = computeCartTotals();
        const finalTotal = total + shippingCost;
        document.getElementById("summaryTotal").textContent = formatMoney(finalTotal);
    }

    function populateCountries() {
        const select = document.getElementById("country");
        select.innerHTML = "";
        
        arabCountries.forEach(code => {
            const option = document.createElement("option");
            option.value = code;
            const name = i18n[currentLang].arabCountries && i18n[currentLang].arabCountries[code] 
                         ? i18n[currentLang].arabCountries[code] 
                         : code;
            option.textContent = name;
            select.appendChild(option);
        });

        // Set default to BH
        select.value = "BH";
    }

    function loadCart() {
      try {
        const raw = localStorage.getItem("ezCart");
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    const cartItems = loadCart();

    function computeCartTotals() {
      let total = 0;
      let count = 0;
      for (const item of cartItems) {
        const qty = Number(item.quantity) || 1;
        const up = Number(item.unitPrice) || Number(item.total) || 0;
        count += qty;
        total += up * qty;
      }
      return { total: Number(total) || 0, count: Number(count) || 0 };
    }

    function renderSummary() {
      const listEl = document.getElementById("summaryItemsList");
      const emptyEl = document.getElementById("summaryEmpty");
      
      listEl.innerHTML = "";
      if (!cartItems.length) {
        emptyEl.style.display = "block";
      } else {
        emptyEl.style.display = "none";
      }

      cartItems.forEach(item => {
        const itemBlock = document.createElement("div");
        itemBlock.className = "summary-item-block";
        itemBlock.style.marginBottom = "24px";

        if (item.previewFront && item.previewBack) {
          const previewGrid = document.createElement("div");
          previewGrid.className = "checkout-controller-preview-dual";

          const boxF = document.createElement("div");
          boxF.className = "preview-box";
          renderPreview(boxF, item.previewFront);
          const lblF = document.createElement("div");
          lblF.className = "preview-label";
          lblF.textContent = currentLang === "ar" ? "\u0627\u0644\u0623\u0645\u0627\u0645" : "Front";
          boxF.appendChild(lblF);

          const boxB = document.createElement("div");
          boxB.className = "preview-box";
          renderPreview(boxB, item.previewBack);
          const lblB = document.createElement("div");
          lblB.className = "preview-label";
          lblB.textContent = currentLang === "ar" ? "\u0627\u0644\u062e\u0644\u0641" : "Back";
          boxB.appendChild(lblB);

          previewGrid.appendChild(boxF);
          previewGrid.appendChild(boxB);
          itemBlock.appendChild(previewGrid);
        }

        const row = document.createElement("div");
        row.className = "summary-item-row";
        const nameEl = document.createElement("div");
        nameEl.textContent = (item.name || t("productName")) + " × " + item.quantity;
        const priceEl = document.createElement("div");
        priceEl.textContent = formatMoney(item.unitPrice * item.quantity);
        row.appendChild(nameEl);
        row.appendChild(priceEl);
        
        itemBlock.appendChild(row);
        listEl.appendChild(itemBlock);
      });

      const { total, count } = computeCartTotals();
      document.getElementById("navTotal").textContent = formatMoney(total);
      document.getElementById("summaryItemsCount").textContent = count;
      document.getElementById("summarySubtotal").textContent = formatMoney(total);
      updateShippingUI();
    }

    function applyLanguage() {
      document.documentElement.lang = currentLang;
      document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
      populateCountries();
      document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (i18n[currentLang][key]) el.textContent = i18n[currentLang][key];
      });
      renderSummary();
      updateShippingUI();
    }

    const countrySelect = document.getElementById("country");
    countrySelect.addEventListener("change", updateShippingUI);
    const shippingRadios = document.querySelectorAll('input[name="shippingType"]');
    shippingRadios.forEach(radio => radio.addEventListener("change", updateShippingUI));

    const navLangToggle = document.getElementById("langToggle");
    const mobileLangToggle = document.getElementById("mobileLangToggle");
    function toggleLanguage() {
      currentLang = currentLang === "ar" ? "en" : "ar";
      localStorage.setItem("ez_lang", currentLang);
      applyLanguage();
    }
    if (navLangToggle) navLangToggle.addEventListener("click", toggleLanguage);
    if (mobileLangToggle) mobileLangToggle.addEventListener("click", toggleLanguage);

    applyLanguage();

    const checkoutForm = document.getElementById("checkoutForm");
    const placeOrderBtn = document.getElementById("placeOrderBtn");
    const btnText = placeOrderBtn.querySelector(".btn-text");
    const btnLoader = placeOrderBtn.querySelector(".btn-loader");

    const phoneInput = document.getElementById("phone");
    if (phoneInput) {
      phoneInput.addEventListener("input", (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, "");
      });
    }

    checkoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!cartItems.length) { alert(t("alertNoItems")); return; }

      // Set Loading State
      placeOrderBtn.disabled = true;
      btnText.style.opacity = "0.5";
      btnLoader.style.display = "block";

      const formData = new FormData(checkoutForm);
      const data = Object.fromEntries(formData.entries());
      data.agree = document.getElementById("agree").checked;
      
      const { total } = computeCartTotals();
      data.subtotal = total;
      data.shippingCost = Number(data.shippingCost);
      data.total = total + data.shippingCost;
      data.itemsCount = computeCartTotals().count;
      data.cart = cartItems;
      data.fullName = ((data.firstName || "") + " " + (data.lastName || "")).trim();
      
      // Combine prefix and main phone
      const prefix = document.getElementById("phonePrefix").value;
      const mainPhone = document.getElementById("phone").value;
      data.phone = "+" + prefix + mainPhone;
      
      if (!data.addressLine1) {
          data.addressLine1 = "Store Pickup";
          data.city = "Manama";
      }

      try {
        localStorage.setItem("ezOrderDraft", JSON.stringify(data));
        window.location.href = "/payment";
      } catch (err) {
        console.error("Storage Error:", err);
        if (err.name === 'QuotaExceededError' || err.code === 22) {
           alert(currentLang === "ar" ? "خطأ: مساحة التخزين في متصفحك ممتلئة. يرجى إزالة بعض العناصر من السلة والمحاولة مرة أخرى." : "Error: Browser storage is full. Please remove some items from the cart and try again.");
        } else {
           alert(t("paymentStartFailed"));
        }
        placeOrderBtn.disabled = false;
        btnText.style.opacity = "1";
        btnLoader.style.display = "none";
      }
    });
`;

function CheckoutPage() {
  useEffect(() => {
    const scriptEl = document.createElement('script');
    scriptEl.textContent = checkoutScript;
    document.body.appendChild(scriptEl);
    return () => {
      if (document.body.contains(scriptEl)) document.body.removeChild(scriptEl);
    };
  }, []);

  return (
    <div className="checkout-page">
      <div dangerouslySetInnerHTML={{ __html: checkoutMarkup }} />
    </div>
  );
}

export default CheckoutPage;
