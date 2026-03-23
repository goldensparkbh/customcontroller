import{r as e,j as a}from"./index-CaWkSKir.js";const s=`
<canvas id="bgCanvas"></canvas>
<div class="top-nav" style="display:none;"></div>

<div class="pos-container">
  <!-- Dynamic Sidebar -->
  <aside class="pos-sidebar">
    <div class="pos-sidebar-inner">
      <div class="pos-search-box">
        <input type="text" id="posSearch" placeholder="بحث عن منتج..." data-i18n-placeholder="posSearchPlaceholder">
        <svg class="search-icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
      </div>
      
      <div class="pos-filter-group">
        <h3 data-i18n="posCategories">الأقسام</h3>
        <div class="pos-category-list" id="posCategoryList">
          <button class="pos-category-btn active" data-category="all" data-i18n="posCatAll">الكل</button>
        </div>
      </div>

      <div class="pos-filter-group">
        <h3 data-i18n="posStatusFilter">الحالة</h3>
        <div class="pos-status-filters">
           <label class="pos-filter-item">
             <input type="checkbox" id="filterInStock" checked>
             <span data-i18n="posFilterInStock">متوفر فقط</span>
           </label>
        </div>
      </div>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="pos-main">
    <div class="pos-toolbar">
      <div id="posStatus" class="pos-status-msg"></div>
      <div class="pos-view-options">
        <span id="posItemCount">0</span> <span data-i18n="posCountSuffix">منتجات</span>
      </div>
    </div>
    
    <div class="pos-grid" id="posGrid">
      <!-- Loading Skeletons -->
      <div class="pos-skeleton"></div>
      <div class="pos-skeleton"></div>
      <div class="pos-skeleton"></div>
      <div class="pos-skeleton"></div>
    </div>
  </main>

  <!-- POS Cart Panel -->
  <aside class="pos-cart-panel" id="posCartPanel">
    <div class="pos-cart-header">
      <button class="pos-cart-close" id="closeCart">&times;</button>
      <h3 data-i18n="posCartTitle">السلة</h3>
      <button class="pos-cart-clear" id="clearCart" data-i18n="posClearCart">مسح</button>
    </div>
    <div class="pos-cart-items" id="posCartItems">
      <!-- Cart items injected here -->
      <div class="pos-cart-empty" data-i18n="posCartEmpty">السلة فارغة</div>
    </div>
    <div class="pos-cart-footer">
      <div class="pos-cart-total-row">
        <span data-i18n="posSubtotal">المجموع</span>
        <span id="posSubtotalValue">0.000 BHD</span>
      </div>
      <button class="pos-checkout-btn" id="posCheckout" data-i18n="posCheckout">إتمام الطلب</button>
    </div>
  </aside>
</div>

<div class="mobile-nav-overlay" id="mobileNavOverlay"></div>
<aside class="mobile-nav-drawer" id="mobileNavDrawer" aria-hidden="true">
  <div class="mobile-drawer-header">
     <button class="nav-close-btn" id="closeMobileNav">&times;</button>
  </div>
  <nav class="mobile-nav-list">
    <a class="mobile-nav-link" href="/#premadeSection" data-i18n="navPremade">تصاميم جاهزة</a>
    <a class="mobile-nav-link mobile-nav-cta" href="/configurator" data-i18n="navBuildCta">صمّم ذراعك الآن</a>
    <button class="mobile-nav-link mobile-nav-lang" id="mobileLangToggle" type="button">EN</button>
  </nav>
</aside>
`,o=`
  let navLang = localStorage.getItem("ez_lang") || "ar";
  const i18n = window.__EZ_I18N__ || {};
  
  function t(key) {
    return (i18n[navLang] && i18n[navLang][key]) || key;
  }

  function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      el.placeholder = t(key);
    });
    
    // Update labels for toggles
    const langToggle = document.getElementById("langToggle");
    if (langToggle) langToggle.textContent = navLang === "ar" ? "EN" : "AR";
    const mobileLangToggle = document.getElementById("mobileLangToggle");
    if (mobileLangToggle) mobileLangToggle.textContent = navLang === "ar" ? "EN" : "AR";
  }

  // --- Mobile Navigation ---
  function setMobileNavOpen(isOpen) {
    const overlay = document.getElementById("mobileNavOverlay");
    const drawer = document.getElementById("mobileNavDrawer");
    const btn = document.querySelector(".nav-menu-btn");
    
    if (overlay) overlay.classList.toggle("open", isOpen);
    if (drawer) drawer.classList.toggle("open", isOpen);
    if (btn) btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    document.body.classList.toggle("mobile-nav-open", isOpen);
  }

  // --- Cart Drawer Logic ---
  function setCartOpen(isOpen) {
    const panel = document.getElementById("posCartPanel");
    if (panel) panel.classList.toggle("open", isOpen);
  }

  let allProducts = [];
  let currentCategory = "all";
  let searchQuery = "";
  let showInStockOnly = true;
  let lastProductsHash = "";

  const gridEl = document.getElementById("posGrid");
  const statusEl = document.getElementById("posStatus");
  const countEl = document.getElementById("posItemCount");
  const cartItemsEl = document.getElementById("posCartItems");
  const subtotalValueEl = document.getElementById("posSubtotalValue");
  const categoryListEl = document.getElementById("posCategoryList");

  function setStatus(msg) { statusEl.textContent = msg; }

  async function loadItems() {
    // gridEl.innerHTML remains skeletons initially
    setStatus(t("posStatusLoading"));
    try {
      const orgId = "892379608";
      const url = \`/zoho/inventory/v1/items?organization_id=\${orgId}&per_page=200\`;
      console.log("[POS] Fetching items from:", url);
      const res = await fetch(url);
      if (!res.ok) {
         const errText = await res.text();
         console.error(\`[POS] Fetch failed (\${res.status}):\`, errText);
         throw new Error("HTTP " + res.status);
      }
      const json = await res.json();
      const items = json.items || [];
      console.log(\`[POS] Received \${items.length} items from Zoho.\`);
      
      const filteredItems = items.filter(it => {
          const status = (it.status || it.item_status || "").toLowerCase();
          const name = it.name || it.item_name || "";
          const sku = it.sku || "";
          const isActive = (status === "" || status === "active" || status === "active");
          const isNotPS5 = !name.toLowerCase().startsWith("ps5_") && !sku.toLowerCase().startsWith("ps5_");
          return isActive && isNotPS5;
      });
      console.log(\`[POS] Filtered to \${filteredItems.length} non-configurator items.\`);
      
      allProducts = filteredItems;
      
      renderCategories();
      filterAndRender();
      setStatus(allProducts.length + " " + t("posStatusLoadedSuffix"));
    } catch (err) {
      console.error("[POS] Error fetching items:", err);
      setStatus(t("posStatusFailedPrefix") + err.message);
    }
  }

  function renderCategories() {
    const cats = new Set();
    allProducts.forEach(p => {
      let cat = p.cf_category;
      if (!cat && p.custom_fields) {
          const found = p.custom_fields.find(f => f.label === "Category" || f.api_name === "cf_category");
          if (found) cat = found.value;
      }
      if (!cat) cat = p.category_name; 
      
      p._displayCategory = cat || "Other";
      if (cat) cats.add(cat);
    });
    
    categoryListEl.innerHTML = '<button class="pos-category-btn active" data-category="all">' + t("posCatAll") + '</button>';
    const sortedCats = Array.from(cats).sort();
    sortedCats.forEach(cat => {
      const btn = document.createElement("button");
      btn.className = "pos-category-btn";
      btn.dataset.category = cat;
      btn.textContent = cat;
      btn.onclick = () => {
        document.querySelectorAll(".pos-category-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentCategory = cat;
        filterAndRender();
      };
      categoryListEl.appendChild(btn);
    });
    
    document.querySelector('[data-category="all"]').onclick = (e) => {
        document.querySelectorAll(".pos-category-btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        currentCategory = "all";
        filterAndRender();
    };
  }

  function filterAndRender() {
    const filtered = allProducts.filter(p => {
      const matchCat = currentCategory === "all" || p._displayCategory === currentCategory;
      const name = p.name || p.item_name || "";
      const matchSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      const avail = p.available_stock != null ? p.available_stock : (p.stock_on_hand || 0);
      const matchStock = !showInStockOnly || (avail > 0);
      return matchCat && matchSearch && matchStock;
    });

    renderProducts(filtered);
  }

  function renderProducts(items) {
    const currentHash = items.map(it => it.item_id || it.itemid).join(",");
    if (currentHash === lastProductsHash && gridEl.children.length > 0 && !gridEl.querySelector(".pos-skeleton")) return;
    lastProductsHash = currentHash;

    countEl.textContent = items.length;
    
    if (items.length === 0) {
      gridEl.innerHTML = '<div class="pos-empty-state">' + t("posNoProductsFound") + '</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach(it => {
      const card = document.createElement("div");
      card.className = "pos-product-card";
      
      const rate = typeof it.rate === "number" ? it.rate.toFixed(3) : "0.000";
      const avail = it.available_stock != null ? it.available_stock : it.stock_on_hand;
      const itemId = it.item_id || it.itemid;
      const hasImg = it.image_name || it.image_id || it.image_url;
      const imageUrl = hasImg ? '/zoho/inventory/v1/items/' + itemId + '/image?organization_id=892379608' : '/assets/placeholder.png';

let html = '<div class="pos-product-img">';
html += '<img src="' + imageUrl + '" alt="' + (it.name || it.item_name) + '" onerror="this.src='/assets/placeholder.png'">';
html += '</div>';
html += '<div class="pos-product-info">';
html += '<div class="pos-product-name">' + (it.name || it.item_name) + '</div>';
html += '<div class="pos-product-price">BHD ' + rate + '</div>';
html += '<div class="pos-product-stock">' + t("posStockLabel") + ': ' + (avail ?? "—") + '</div>';
html += '</div>';
html += '<button class="pos-add-btn" ' + (avail != null && avail <= 0 ? 'disabled' : '') + '>' + t("posAddToCart") + '</button>';

card.innerHTML = html;
card.querySelector(".pos-add-btn").onclick = () => addToCart(it);
fragment.appendChild(card);
    });

gridEl.innerHTML = "";
gridEl.appendChild(fragment);
  }

// Cart Management
let cart = [];
try {
  const saved = localStorage.getItem("ezCart");
  if (saved) cart = JSON.parse(saved);
} catch (e) { }

function addToCart(item) {
  const itemId = item.item_id || item.itemid;
  const existing = cart.find(c => c.itemId === itemId);
  if (existing) {
    existing.quantity++;
  } else {
    const hasImg = item.image_name || item.image_id || item.image_url;
    cart.push({
      id: Date.now(),
      itemId: itemId,
      name: item.name || item.item_name,
      unitPrice: item.rate,
      quantity: 1,
      preview: hasImg ? '/zoho/inventory/v1/items/' + itemId + '/image' : '/assets/placeholder.png'
    });
  }
  updateCart();
  if (window.innerWidth <= 1000) {
    setCartOpen(true);
  }
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  updateCart();
}

function updateCart() {
  localStorage.setItem("ezCart", JSON.stringify(cart));
  renderCart();

  const badge = document.getElementById("cartBadge");
  if (badge) {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? "flex" : "none";
  }
}

function renderCart() {
  cartItemsEl.innerHTML = "";
  if (cart.length === 0) {
    cartItemsEl.innerHTML = '<div class="pos-cart-empty">' + t("posCartEmpty") + '</div>';
    subtotalValueEl.textContent = "0.000 BHD";
    return;
  }

  let subtotal = 0;
  cart.forEach(item => {
    subtotal += item.unitPrice * item.quantity;
    const div = document.createElement("div");
    div.className = "pos-cart-item";

    const imageUrl = item.preview ? (item.preview.includes('?') ? item.preview + '&organization_id=892379608' : item.preview + '?organization_id=892379608') : '/assets/placeholder.png';
    if (!imageUrl.startsWith('/')) imageUrl = '/assets/placeholder.png'; // safety

    let html = '<img class="pos-cart-item-img" src="' + imageUrl + '" onerror="this.src='/assets/placeholder.png'">';
    html += '<div class="pos-cart-item-info">';
    html += '<div class="pos-cart-item-name">' + item.name + '</div>';
    html += '<div class="pos-cart-item-price">BHD ' + item.unitPrice.toFixed(3) + '</div>';
    html += '</div>';
    html += '<div class="pos-cart-item-ctrl">';
    html += '<button class="qty-minus">-</button>';
    html += '<span class="pos-cart-item-qty">' + item.quantity + '</span>';
    html += '<button class="qty-plus">+</button>';
    html += '</div>';

    div.innerHTML = html;
    div.querySelector(".qty-minus").onclick = () => {
      if (item.quantity > 1) { item.quantity--; updateCart(); }
      else { removeFromCart(item.id); }
    };
    div.querySelector(".qty-plus").onclick = () => { item.quantity++; updateCart(); };

    cartItemsEl.appendChild(div);
  });

  subtotalValueEl.textContent = subtotal.toFixed(3) + " BHD";
}

// --- Event Listeners ---

// Search & Filter with debounce
let searchTimeout;
document.getElementById("posSearch").oninput = (e) => {
  clearTimeout(searchTimeout);
  searchQuery = e.target.value;
  searchTimeout = setTimeout(() => {
    filterAndRender();
  }, 300);
};
document.getElementById("filterInStock").onchange = (e) => {
  showInStockOnly = e.target.checked;
  filterAndRender();
};

// Cart Actions
document.getElementById("clearCart").onclick = () => {
  cart = [];
  updateCart();
};
document.getElementById("posCheckout").onclick = () => {
  if (cart.length > 0) window.location.href = "/checkout";
};
document.getElementById("cartToggle").onclick = () => setCartOpen(true);
document.getElementById("closeCart").onclick = () => setCartOpen(false);

// Mobile Nav Toggles
document.querySelector(".nav-menu-btn").onclick = () => setMobileNavOpen(true);
document.getElementById("mobileNavOverlay").onclick = () => setMobileNavOpen(false);
const closeNavBtn = document.getElementById("closeMobileNav");
if (closeNavBtn) closeNavBtn.onclick = () => setMobileNavOpen(false);

document.getElementById("mobileNavDrawer").querySelectorAll("a").forEach(a => {
  a.onclick = () => setMobileNavOpen(false);
});

// Language Toggles
const handleLangToggle = () => {
  navLang = navLang === "ar" ? "en" : "ar";
  localStorage.setItem("ez_lang", navLang);
  location.reload();
};
document.getElementById("langToggle").onclick = handleLangToggle;
document.getElementById("mobileLangToggle").onclick = handleLangToggle;

// Initialize
applyTranslations();
loadItems();
updateCart(); // Initial badge & items
`;function i(){return e.useEffect(()=>{const t=document.createElement("script");return t.textContent=o,document.body.appendChild(t),()=>{document.body.contains(t)&&document.body.removeChild(t)}},[]),a.jsx("div",{dangerouslySetInnerHTML:{__html:s}})}export{i as default};
