import{r as o,i as s,j as t}from"./index-uZjsNsd9.js";const i=`
<canvas id="bgCanvas"></canvas>
<div class="zoho-loading-overlay" id="zohoLoadingOverlay" aria-live="polite" aria-hidden="false">
<div class="zoho-loading-card">
<img src="/assets/loading.gif" class="zoho-loading-gif" alt="Loading..." />
<div class="zoho-loading-text" data-i18n="loadingConfigurator">Loading configurator...</div>
</div>
</div>
<audio id="sfxClick" preload="auto" src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="></audio>
<audio id="sfxClick2" preload="auto" src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="></audio>
<div class="top-nav">
<div class="nav-logo">
<a class="nav-left" href="/">
<span class="nav-logo-mark" role="img" aria-label="Custom Controller"></span>
</a>
</div>
<button class="nav-menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNavDrawer">
<span></span>
<span></span>
<span></span>
</button>
<div class="nav-right">
<button class="nav-link nav-lang" id="langToggle" type="button" aria-label="Language" title="Language"><span class="nav-lang-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="img" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6h9"></path><path d="M8 6c0 4-1.7 7.5-4.5 10"></path><path d="M5.8 11.5c1.4 1.5 3 2.8 4.9 3.9"></path><path d="M14.5 6h6"></path><path d="M17.5 4v2"></path><path d="M15 20l3-8 3 8"></path><path d="M16 17.5h4"></path></svg></span></button>
</div>
</div>
<div class="mobile-nav-overlay" id="mobileNavOverlay"></div>
<aside class="mobile-nav-drawer" id="mobileNavDrawer" aria-hidden="true">
<button class="mobile-nav-link mobile-nav-lang" id="mobileLangToggle" type="button" aria-label="Language" title="Language"><span class="nav-lang-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="img" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6h9"></path><path d="M8 6c0 4-1.7 7.5-4.5 10"></path><path d="M5.8 11.5c1.4 1.5 3 2.8 4.9 3.9"></path><path d="M14.5 6h6"></path><path d="M17.5 4v2"></path><path d="M15 20l3-8 3 8"></path><path d="M16 17.5h4"></path></svg></span></button>
</aside>
<div class="page-content">
<div class="main-layout">
<div class="controller-column">
<div class="controller-wrapper" id="controllerWrapper">
<div class="controller-area" id="controllerArea">
<div class="controller-bg"></div>
<div class="controller-flip" id="controllerFlip">
<div class="controller-face controller-face-front" id="controllerFaceFront">
<img alt="PS5 Controller Front" src="/assets/controller.png"/>
<img id="overlay-shell" src="/assets/controller_t_shell.png" style="display:none; position:absolute; inset:0; z-index:2; width:100%; height:100%; object-fit:contain; pointer-events:none;"/>
<img id="overlay-trim" src="/assets/controller_t_trim.png" style="display:none; position:absolute; inset:0; z-index:2; width:100%; height:100%; object-fit:contain; pointer-events:none;"/>
<img id="overlay-touchpad" src="/assets/controller_t_touchpad.png" style="display:none; position:absolute; inset:0; z-index:2; width:100%; height:100%; object-fit:contain; pointer-events:none;"/>
</div>
<div class="controller-face controller-face-back" id="controllerFaceBack">
<img alt="PS5 Controller Back" src="/assets/controller_back.png"/>
</div>
</div>
</div>
<div class="mobile-panel-switch" id="mobilePanelSwitch">
<button class="panel-switch-btn active" data-panel="options" type="button">
<span data-i18n="partsOptionsHeading">Performance</span>
</button>
<div class="flip-toggle-wrapper">
<button class="flip-toggle" id="controllerFlipBtn" type="button">
<span class="flip-toggle-preview">
<img class="flip-toggle-front" src="/assets/icons/backShellMain.png"/>
<img class="flip-toggle-back" src="/assets/icons/shells.png"/>
</span>
</button>
</div>
<button class="panel-switch-btn" data-panel="colors" type="button">
<span data-i18n="partsColorsHeading">Aesthetics</span>
</button>
</div>
<div class="mobile-options-grid horizontal-scroll" id="mobileOptionsGrid"></div>
</div>
</div>
<div class="colors-column" id="colors-column">
<div class="color-panel">
<div class="color-panel-grid" id="optionsPanelGrid"></div>
<div class="color-panel-header" id="colorPanelHeaderBottom">
<div class="color-panel-sub" id="colorPanelSub" data-i18n="partsColorsHeading">Aesthetics</div>
</div>
<div class="color-panel-grid2" id="colorPanelGrid"></div>
<div class="color-empty-placeholder" id="colorEmptyState">
<img src="/assets/icons/shells.png"/>
</div>
</div>
</div>
<div class="parts-column" id="parts-column">
<div class="parts-list" data-list="primary"></div>
</div>
<div class="configurator-controls" id="configuratorControls">
<button class="control-btn" data-panel="options" title="Options">
<span class="control-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3M12 21v-2M9 17h6M9 7h6"></path></svg></span>
</button>
<button class="control-btn" data-panel="colors" title="Colors">
<span class="control-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v8M8 12h8"></path></svg></span>
</button>
<button class="control-btn" data-action="flip" title="Flip">
<span class="control-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 10l5-5 5 5M7 14l5 5 5-5"></path></svg></span>
</button>
<button class="control-btn" id="langSwitchBtn">
<span class="control-icon">
<svg class="flag-icon flag-en" viewBox="0 0 24 16">
<rect width="24" height="16" fill="#012169"/>
<path d="M0 0l24 16M24 0L0 16" stroke="#fff" stroke-width="3"/>
<path d="M0 0l24 16M24 0L0 16" stroke="#c8102e" stroke-width="2"/>
<path d="M12 0v16M0 8h24" stroke="#fff" stroke-width="5"/>
<path d="M12 0v16M0 8h24" stroke="#c8102e" stroke-width="3"/>
</svg>
</span>
</button>
</div>
</div>
<div class="controller-bottom-bar">
<div class="nav-amount-block">
<div class="nav-amount-value" id="summaryAmount">BHD 0.00</div>
</div>
<div class="bottom-actions">
<button class="clear-selection-btn" id="clearSelectionBtn" title="Clear All Selection">
<span class="clear-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6m4-16v6"></path></svg></span>
</button>
<button class="add-to-cart-btn" id="addToCartBtn">
<span class="cart-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="20" r="1.8"></circle><circle cx="18" cy="20" r="1.8"></circle><path d="M3 4h2l2.2 10.5a2 2 0 0 0 2 1.5h8.5a2 2 0 0 0 2-1.5l1.6-7.5H6.2"></path></svg></span>
<span class="add-label" data-i18n="addToCart">Add to Cart</span>
<span class="add-amount" id="summaryAmountAlt">BHD 0.00</span>
</button>
</div>
</div>
</div>
<div class="part-tooltip" id="partTooltip"></div>
`;function n(){return o.useEffect(()=>{document.body.classList.add("configurator-page-active"),window.__CONFIG_DATA__={i18n:s,zohoAccessToken:"1000.7e717720fad33ceb86442de697965dc7.af8c67230ddae4d39636b74a46f1c951",zohoOrgId:"892379608"};const a=document.createElement("script");return a.src="/configurator-logic.js?v="+new Date().getTime(),a.async=!0,document.body.appendChild(a),()=>{document.body.classList.remove("configurator-page-active"),document.body.removeChild(a),delete window.__CONFIG_DATA__}},[]),t.jsx("div",{className:"configurator-page",children:t.jsx("div",{dangerouslySetInnerHTML:{__html:i}})})}export{n as default};
