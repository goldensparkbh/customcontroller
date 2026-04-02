import{r as c,j as d,L as h,i as p,g as v,c as g,d as u,a as m,b as A}from"./index-D8qe2hIb.js";import{b as w}from"./inventoryPricing-CXTXwyZ6.js";const y=`
<canvas id="bgCanvas"></canvas>
<div class="zoho-loading-overlay" id="zohoLoadingOverlay" aria-live="polite" aria-hidden="false">
<div class="zoho-loading-card">
<div class="zoho-loading-spinner" aria-hidden="true"></div>
<div class="zoho-loading-text" data-i18n="loadingConfigurator">Loading configurator...</div>
</div>
</div>
<audio id="sfxClick" preload="auto" src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="></audio>
<audio id="sfxClick2" preload="auto" src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="></audio>
<div class="page-content">
<div class="main-layout">
<!-- CONTROLLER COLUMN (LEFT) -->
<div class="controller-column">
<div class="controller-wrapper" id="controllerWrapper">
<div class="controller-area" id="controllerArea">
<div class="controller-bg"></div>
<div class="controller-flip" id="controllerFlip">
<div class="controller-face controller-face-front" id="controllerFaceFront">
<img alt="PS5 Controller Front" src="/assets/controller.png"/>
</div>
<div class="controller-face controller-face-back" id="controllerFaceBack">
<img alt="PS5 Controller Back" src="/assets/controller_back.png"/>
</div>
</div>
</div>
<!-- buttons under the controller -->
<div class="controller-buttons-stack">
<button class="flip-toggle" id="controllerFlipBtn" type="button" aria-label="الأمام">
<span class="flip-toggle-preview" aria-hidden="true">
<img class="flip-toggle-front" alt="" src="/assets/controller.png"/>
<img class="flip-toggle-back" alt="" src="/assets/controller_back.png"/>
</span>
</button>
</div>
  </div>
</div>
<!-- COLORS COLUMN (MIDDLE) -->
<div class="colors-column" id="colors-column">
  <button class="mobile-scroll-btn mobile-scroll-up" id="mobileScrollUp" type="button" aria-label="Scroll Up">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 15l-6-6-6 6"/>
    </svg>
  </button>
<div class="color-panel">
<!-- Options grid (stick type ...) -->
<div class="color-panel-grid" id="optionsPanelGrid"></div>
<!-- Colors grid -->
<div class="color-panel-grid2" id="colorPanelGrid"></div>
<!-- Empty state (shown when no part is selected) -->
<div class="color-empty-placeholder" id="colorEmptyState">
<!-- change the image path to whatever big icon you want -->
<img alt="Select a part" src="/assets/icons/shells.png"/>
</div>
</div>
  <button class="mobile-scroll-btn mobile-scroll-down" id="mobileScrollDown" type="button" aria-label="Scroll Down">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 9l6 6 6-6"/>
    </svg>
  </button>
</div>
<!-- PARTS COLUMN (RIGHT) -->
<div class="parts-column">
<button class="mobile-selected-part" id="mobileSelectedPart" type="button" aria-label="Selected part">
<img alt="" src="/assets/icons/shells.png"/>
</button>
<button class="mobile-scroll-btn mobile-scroll-left" id="mobileScrollLeftBtn" type="button" aria-label="Scroll Left">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M15 18l-6-6 6-6"/>
  </svg>
</button>
<button class="mobile-scroll-btn mobile-scroll-right" id="mobileScrollRightBtn" type="button" aria-label="Scroll Right">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
</button>
<div class="parts-panel">
<div class="parts-accordion">
<div class="accordion-item open">
<button class="accordion-header" type="button">
<div class="parts-title" data-i18n="partsOptionsHeading">الخيارات</div>
<span aria-hidden="true" class="accordion-icon"></span>
</button>
<div class="accordion-content">
<div class="accordion-body">
<div class="parts-list" data-list="primary"></div>
</div>
</div>
</div>
<div class="accordion-item">
<button class="accordion-header" type="button">
<div class="parts-title" data-i18n="partsColorsHeading">الألوان</div>
<span aria-hidden="true" class="accordion-icon"></span>
</button>
<div class="accordion-content">
<div class="accordion-body">
<div class="parts-list" data-list="secondary"></div>
</div>
</div>
</div>
</div>
</div>
</div>
</div>
<div class="configurator-controls" id="configuratorControls" aria-label="Configurator controls">
<button class="control-btn control-flip" id="flipControlBtn" data-action="flip" type="button" aria-label="الأمام">
<span class="flip-preview" aria-hidden="true">
<img class="flip-preview-front" alt="" src="/assets/controller.png"/>
<img class="flip-preview-back" alt="" src="/assets/controller_back.png"/>
</span>
</button>
<button class="control-btn control-lang" id="langSwitchBtn" type="button" aria-label="اختيار اللغة">
<span class="control-icon" aria-hidden="true">
<svg class="flag-icon flag-en" viewBox="0 0 24 16" role="img" aria-hidden="true">
<rect width="24" height="16" fill="#0a3d8f"/>
<rect x="10" width="4" height="16" fill="#ffffff"/>
<rect y="6" width="24" height="4" fill="#ffffff"/>
<rect x="11" width="2" height="16" fill="#d91c1c"/>
<rect y="7" width="24" height="2" fill="#d91c1c"/>
</svg>
<svg class="flag-icon flag-ar" viewBox="0 0 24 16" role="img" aria-hidden="true">
<rect width="24" height="16" fill="#0b7a3b"/>
<rect x="3" y="6" width="18" height="4" fill="#f4f4f4"/>
</svg>
</span>
<span class="control-label" data-i18n="chooseLanguage">EN</span>
</button>
</div>
<!-- FIXED BOTTOM BAR: total + add to cart -->
<div class="controller-bottom-bar">
<div class="nav-amount-block">
<div class="nav-amount-label" data-i18n="totalLabel">الإجمالي</div>
<div class="nav-amount-value" id="summaryAmount">د.ب 0.00</div>
</div>
<div class="controller-action-buttons">
<button class="clear-selection-btn" id="clearSelectionBtn" type="button" aria-label="Clear selections" title="Clear selections">
        <span class="clear-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M8 6V4.8c0-.88.72-1.6 1.6-1.6h4.8c.88 0 1.6.72 1.6 1.6V6"></path>
            <path d="M18 6l-1 13.2A2 2 0 0 1 15.01 21H8.99a2 2 0 0 1-1.99-1.8L6 6"></path>
            <path d="M10 10.2v6"></path>
            <path d="M14 10.2v6"></path>
          </svg>
        </span>
      </button>

<button class="add-to-cart-btn" id="addToCartBtn" aria-label="Add to Cart">
        <span class="cart-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <circle cx="9" cy="20" r="1.8"></circle>
            <circle cx="18" cy="20" r="1.8"></circle>
            <path d="M3 4h2l2.2 10.5a2 2 0 0 0 2 1.5h8.5a2 2 0 0 0 2-1.5l1.6-7.5H6.2"></path>
          </svg>
        </span>
      </button>
</div>
</div>
</div>
<div class="part-tooltip" id="partTooltip"></div>
`,_=()=>{const[s,b]=c.useState(!0);if(c.useEffect(()=>{(async()=>{try{const n=(await v(g(u,"configurator_parts"))).docs.map(i=>({id:i.id,...i.data()}));for(const i of n){const f=await v(g(u,`configurator_parts/${i.id}/options`));i.options=f.docs.map(l=>{const o=l.data();return{id:l.id,...o,...w(o.inventoryDetails,{purchasePrice:o.purchasePrice??0,sellPrice:o.sellPrice??o.price??0},{quantity:o.quantity??0})}}).filter(l=>l.active!==!1)}const t=await m(A(u,"configurator_settings","general"));let e=0;t.exists()&&(e=Number(t.data().basePrice)||0),window.__CONFIG_FIREBASE_DATA__=n,window.__CONFIG_DATA__={i18n:p,baseControllerPrice:e}}catch(r){console.error("Firebase fetch error:",r)}finally{b(!1)}})()},[]),c.useEffect(()=>{if(s)return;document.body.classList.add("configurator-page-active");const a=window.requestAnimationFrame(()=>{document.body.classList.add("configurator-intro-active")}),r=window.setTimeout(()=>{document.body.classList.remove("configurator-intro-active")},1350);if(!document.getElementById("ez-configurator-logic-script")){const t=document.createElement("script");t.id="ez-configurator-logic-script",t.src="/configurator-logic.js?v="+Date.now(),t.async=!0,document.body.appendChild(t)}return()=>{if(typeof window.__EZ_CONFIGURATOR_CLEANUP__=="function")try{window.__EZ_CONFIGURATOR_CLEANUP__()}catch(e){console.warn("Configurator cleanup failed",e)}document.body.classList.remove("configurator-page-active"),document.body.classList.remove("configurator-intro-active"),window.cancelAnimationFrame(a),window.clearTimeout(r);const t=document.getElementById("ez-configurator-logic-script");t&&document.body.contains(t)&&document.body.removeChild(t)}},[s]),s){const a=localStorage.getItem("ez_lang")||"ar";return d.jsx(h,{message:p[a]&&p[a].loadingConfigurator||"Loading configurator...",fullScreen:!0})}return d.jsx("div",{className:"configurator-page",children:d.jsx("div",{dangerouslySetInnerHTML:{__html:y}})})};export{_ as default};
