
(function () {
    const data = window.__CONFIG_DATA__ || {};
    const i18n = data.i18n || {};
    const ZOHO_ACCESS_TOKEN = data.zohoAccessToken || "";
    const ZOHO_ORG_ID = data.zohoOrgId || "";

    const isMobile =
        new RegExp("Mobi|Android|iPhone|iPad|iPod", "i").test(navigator.userAgent) ||
        window.innerWidth < 700;

    const sfxClickEl = document.getElementById("sfxClick");
    const sfxClick2El = document.getElementById("sfxClick2");

    function playSfx(el) {
        if (!el) return;
        try {
            el.currentTime = 0;
            el.play();
        } catch { }
    }
    const playClick = () => playSfx(sfxClickEl);
    const playClick2 = () => playSfx(sfxClick2El);

    const ZOHO_BASE = "/zoho/inventory/v1";
    const ZOHO_ITEMS_ENDPOINT = ZOHO_BASE + "/items";

    const dynamicColorsByPart = {};
    const dynamicOptionsByPart = {};
    const dynamicPricesByPart = {};
    const selectedPriceByPart = {};
    const selectedOptionPriceByPart = {};
    let availablePartsSet = new Set();
    const zohoFetchError = { hasError: false, message: "" };

    function normalizeVariant(str) {
        if (!str) return "";
        return String(str).toLowerCase().trim().replace(new RegExp("[^a-z0-9]", "g"), "");
    }

    let currentLang = "ar";

    function t(key) {
        return (i18n[currentLang] && i18n[currentLang][key]) || key;
    }

    const BASE_WIDTH = 1166;
    const BASE_HEIGHT = 768;

    const FRONT_PARTS = [
        { id: "shell", icon: "/assets/icons/shells.png", mask: ["/assets/masks/leftShell.png", "/assets/masks/rightShell.png"], priority: 1, side: "front" },
        { id: "trimpiece", icon: "/assets/icons/trimpiece.png", mask: ["/assets/masks/centerBody.png"], priority: 4, side: "front" },
        { id: "sticks", icon: "/assets/icons/sticks.png", mask: ["/assets/masks/stickL.png", "/assets/masks/stickR.png"], priority: 3, side: "front" },
        { id: "allButtons", icon: "/assets/icons/allButtons.png", mask: ["/assets/masks/faceButtons.png", "/assets/masks/share.png", "/assets/masks/options.png"], priority: 3, side: "front" },
        { id: "touchpad", icon: "/assets/icons/touchpad.png", mask: ["/assets/masks/touchpad.png"], priority: 2, side: "front" },
        { id: "bumpersTriggers", icon: "/assets/icons/lsrs.png", mask: ["/assets/masks/bumperL.png", "/assets/masks/bumperR.png"], priority: 2, side: "front", hiddenUI: true },
        { id: "psButton", icon: "/assets/icons/psButton.png", mask: ["/assets/masks/psButton.png"], priority: 5, side: "front" },
    ];

    const BACK_PARTS = [
        { id: "bumpersTriggers", icon: "/assets/icons/lsrs.png", mask: ["/assets/masks/backTriggers.png"], priority: 1, side: "back" },
        { id: "backShellMain", icon: "/assets/icons/backShellMain.png", mask: ["/assets/masks/backShellMain.png"], priority: 2, side: "back" },
    ];

    const ALL_PARTS = [...FRONT_PARTS, ...BACK_PARTS];
    const FRONT_PART_IDS = new Set(FRONT_PARTS.map(part => part.id));
    const BACK_PART_IDS = new Set(BACK_PARTS.map(part => part.id));

    const PART_KEYS = {
        shell: "part_shell",
        trimpiece: "part_trimpiece",
        psButton: "part_psButton",
        allButtons: "part_allButtons",
        sticks: "part_sticks",
        touchpad: "part_touchpad",
        bumpersTriggers: "part_bumpersTriggers",
        backShellMain: "part_backShellMain"
    };

    const PART_SLUG_TO_ID = {
        stick: "sticks",
        stickl: "sticks",
        stickr: "sticks",
        facebuttons: "allButtons",
        share: "allButtons",
        options: "allButtons",
        bumpers: "bumpersTriggers",
        backtriggers: "bumpersTriggers",
        triggers: "bumpersTriggers",
        ls: "bumpersTriggers",
        rs: "bumpersTriggers",
        l2r2: "bumpersTriggers",
        trim: "trimpiece",
        trimpiece: "trimpiece",
        centerbody: "trimpiece",
        centerpiece: "trimpiece",
        middlebody: "trimpiece",
        middle: "trimpiece"
    };
    ALL_PARTS.forEach(p => {
        const slug = normalizeVariant(p.id);
        if (slug) PART_SLUG_TO_ID[slug] = p.id;
    });

    function getPartLabel(partId) {
        const key = PART_KEYS[partId] || partId;
        return t(key);
    }

    const PRICES = {
        psButton: 4.0,
        allButtons: 6.0,
        sticks: 5.0,
        touchpad: 10.0,
        bumpersTriggers: 8.0,
        trimpiece: 12.0,
        shell: 15.0,
        backShellMain: 15.0
    };

    const COLOR_LOOKUP = {
        white: { hex: "#FFFFFF" },
        black: { hex: "#000000" },
        matteblack: { hex: "#0A0A0A" },
        red: { hex: "#C41E2E" },
        blue: { hex: "#0C4BFF" },
        green: { hex: "#008000" },
        yellow: { hex: "#F2D400" },
        orange: { hex: "#FF7A21" },
        purple: { hex: "#800080" },
        pink: { hex: "#FFC0CB" },
        hotpink: { hex: "#E03875" },
        clear: { hex: "#EDEDED" },
        transred: { hex: "#D43838" },
        transblue: { hex: "#2448B5" },
        transgreen: { hex: "#68D78B" },
        transpurple: { hex: "#4E2B8C" }
    };
    const OPTION_LOOKUP = {
        standard: { hex: "#FFFFFF" },
        halleffect: { hex: "#FFD700" },
        tmr: { hex: "#00BFFF" },
        digital: { hex: "#FFFFFF" },
        rampkit: { hex: "#FFFFFF" },
        clicky: { hex: "#FFFFFF" }
    };

    const TRANSPARENT_HEXES = new Set([
        "#ededed",
        "#d43838",
        "#2448b5",
        "#68d78b",
        "#4e2b8c",
        "#8c3b2f",
        "#e3e3e3"
    ]);
    const TRANSPARENT_TINT_OPACITY = 0.7;

    const TRANSPARENCY_HINTS = new Set(["transparent", "trans", "t"]);
    const SOLID_HINTS = new Set(["solid", "opaque", "s"]);

    const SHELL_PART_IDS = new Set([
        "shell",
        "trimpiece",
        "backShellMain",
        "backHandles"
    ]);

    const THUMB_PART_IDS = new Set([
        "stickL",
        "stickR",
    ]);

    function getPaletteForPart(partId) {
        return dynamicColorsByPart[partId] || [];
    }

    function getOptionsForPart(partId) {
        return dynamicOptionsByPart[partId] || [];
    }

    function addVariantToMap(targetMap, partId, variant) {
        if (!targetMap[partId]) targetMap[partId] = [];
        const variantSlug = normalizeVariant(variant.key || "");
        const existing = targetMap[partId].find(v => normalizeVariant(v.key || "") === variantSlug);
        if (existing) {
            if (variant.price != null) existing.price = variant.price;
            if (variant.qty != null) existing.qty = variant.qty;
            if (typeof variant.isTransparent === "boolean") {
                existing.isTransparent = variant.isTransparent;
            }
        } else {
            targetMap[partId].push(variant);
        }
    }

    function parseColorVariant(valueRaw) {
        const value = (valueRaw || "").trim();
        const normalized = normalizeVariant(value.replace(/^color_/, ""));
        const stripped = value.replace("#", "");
        if (new RegExp("^[0-9a-f]{6}$", "i").test(stripped) || new RegExp("^[0-9a-f]{3}$", "i").test(stripped)) {
            const hex = value.startsWith("#") ? value.toUpperCase() : "#" + value.toUpperCase();
            return { hex, key: hex };
        }
        if (COLOR_LOOKUP[normalized]) {
            return { ...COLOR_LOOKUP[normalized], key: normalized };
        }
        return null;
    }

    function parseOptionVariant(valueRaw) {
        const normalized = normalizeVariant(valueRaw);
        if (OPTION_LOOKUP[normalized]) {
            return { ...OPTION_LOOKUP[normalized], key: normalized };
        }
        return null;
    }

    function recomputeAvailableParts() {
        if (!dynamicOptionsByPart["backShellMain"]) dynamicOptionsByPart["backShellMain"] = [];
        const backOpts = dynamicOptionsByPart["backShellMain"];
        if (!backOpts.some(o => normalizeVariant(o.key) === "standard")) {
            backOpts.push({ key: "standard", price: 0 });
        }
        if (!backOpts.some(o => normalizeVariant(o.key) === "rampkit")) {
            backOpts.push({ key: "rampkit" });
        }

        if (!dynamicOptionsByPart["allButtons"]) dynamicOptionsByPart["allButtons"] = [];
        const buttonOpts = dynamicOptionsByPart["allButtons"];
        if (!buttonOpts.some(o => normalizeVariant(o.key) === "standard")) {
            buttonOpts.push({ key: "standard", price: 0 });
        }
        if (!buttonOpts.some(o => normalizeVariant(o.key) === "clicky")) {
            buttonOpts.push({ key: "clicky" });
        }

        const nextSet = new Set();
        ALL_PARTS.forEach(part => {
            const hasColors = getPaletteForPart(part.id).length > 0;
            const hasOptions = getOptionsForPart(part.id).length > 0;
            const hasPrice = dynamicPricesByPart[part.id] != null;
            if (hasColors || hasOptions || hasPrice) nextSet.add(part.id);
        });
        availablePartsSet = nextSet;
    }

    function addPriceFallback(partId, price) {
        if (typeof price === "number" && !Number.isNaN(price) && price >= 0) {
            if (dynamicPricesByPart[partId] == null) dynamicPricesByPart[partId] = price;
        }
    }

    function getItemQty(item) {
        const candidates = [
            item.available_stock,
            item.available_quantity,
            item.availablequantity,
            item.stock_on_hand,
            item.quantity_available,
            item.quantityavailable
        ];
        for (const c of candidates) {
            const n = Number(c);
            if (!Number.isNaN(n)) return n;
        }
        return null;
    }

    const ZOHO_DEBUG_LOGS = [];
    window.__ZOHO_DEBUG_LOGS__ = ZOHO_DEBUG_LOGS;

    function parseZohoItem(item) {
        const rawName = (item && (item.name || item.item_name)) || "";
        const nName = normalizeVariant(rawName);

        const log = { rawName, nName, partId: null, type: null, found: false, reason: "" };
        ZOHO_DEBUG_LOGS.push(log);

        if (!nName.startsWith("ps5")) {
            log.reason = "Does not start with ps5";
            return;
        }

        if (nName.includes("originalcontroller") || nName.includes("basecontroller")) {
            const basePrice = typeof item.rate === "number" ? item.rate : (parseFloat(item.rate) || parseFloat(item.unit_price) || 0);
            if (!Number.isNaN(basePrice) && basePrice > 0) {
                baseControllerPrice = basePrice;
                log.reason = "Base controller price found";
            }
            return;
        }

        let partId = null;
        const sortedSlugs = Object.keys(PART_SLUG_TO_ID).sort((a, b) => b.length - a.length);
        for (const slug of sortedSlugs) {
            if (nName.includes(slug)) {
                partId = PART_SLUG_TO_ID[slug];
                break;
            }
        }

        if (!partId) {
            log.reason = "Part slug not matched";
            return;
        }
        log.partId = partId;

        let type = null;
        if (nName.includes("gamemode") || nName.includes("performance")) type = "gamemode";
        else if (nName.includes("color") || nName.includes("shell") || nName.includes("button") || nName.includes("piece")) type = "color";

        if (!type) {
            if (rawName.match(new RegExp("#[0-9a-fA-F]{3,6}")) || nName.match(new RegExp("[0-9a-f]{6}"))) type = "color";
            else {
                log.reason = "Type (color/gamemode) not identified";
                return;
            }
        }
        log.type = type;

        let transparencyHint = null;
        if (nName.includes("transparent") || nName.includes("trans")) transparencyHint = true;
        else if (nName.includes("solid") || nName.includes("opaque")) transparencyHint = false;

        let col = null;
        let opt = null;
        const price = typeof item.rate === "number" ? item.rate : parseFloat(item.rate);
        const qty = getItemQty(item);

        if (type === "color") {
            const hexMatch = rawName.match(new RegExp("#[0-9a-fA-F]{3,6}"));
            if (hexMatch) {
                const hex = hexMatch[0].toUpperCase();
                col = { hex, key: hex };
            } else {
                const strippedHex = nName.match(new RegExp("[0-9a-f]{6}"));
                if (strippedHex) {
                    const hex = "#" + strippedHex[0].toUpperCase();
                    col = { hex, key: hex };
                } else {
                    for (const presetKey of Object.keys(COLOR_LOOKUP)) {
                        if (nName.includes(presetKey)) {
                            col = { ...COLOR_LOOKUP[presetKey], key: presetKey };
                            break;
                        }
                    }
                }
            }

            if (col) {
                const isTransparent = typeof transparencyHint === "boolean"
                    ? transparencyHint
                    : TRANSPARENT_HEXES.has(col.hex.toLowerCase());

                if (typeof transparencyHint === "boolean") {
                    col.key = col.hex + (isTransparent ? "_t" : "_s");
                } else {
                    col.key = col.hex + (isTransparent ? "_t" : "_s");
                }

                addVariantToMap(dynamicColorsByPart, partId, { ...col, price, qty, isTransparent });
                addPriceFallback(partId, price);
                log.found = true;
                log.key = col.key;
            } else {
                log.reason = "Color value (hex/preset) not found";
            }
        } else if (type === "gamemode") {
            for (const presetKey of Object.keys(OPTION_LOOKUP)) {
                if (nName.includes(presetKey)) {
                    opt = { ...OPTION_LOOKUP[presetKey], key: presetKey };
                    break;
                }
            }
            if (opt) {
                addVariantToMap(dynamicOptionsByPart, partId, { ...opt, price, qty, isGamemode: true });
                addPriceFallback(partId, price);
                log.found = true;
                log.key = opt.key;
            } else {
                log.reason = "Gamemode preset matched none";
            }
        }
    }

    async function fetchZohoItems() {
        const allItems = [];
        const seenIds = new Set();
        let page = 1;
        let perPage = 200;
        let hasMore = true;

        while (hasMore && page < 60) {
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("per_page", String(perPage));
            if (ZOHO_ORG_ID) {
                params.set("organization_id", ZOHO_ORG_ID);
            }
            const url = ZOHO_ITEMS_ENDPOINT + "?" + params.toString();
            try {
                const headers = {};
                if (ZOHO_ACCESS_TOKEN) {
                    headers.Authorization = "Zoho-oauthtoken " + ZOHO_ACCESS_TOKEN;
                }
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                const res = await fetch(url, {
                    headers: Object.keys(headers).length ? headers : undefined,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!res.ok) {
                    zohoFetchError.hasError = true;
                    zohoFetchError.message = "HTTP " + res.status;
                    break;
                }
                const data = await res.json();
                const rawItems = (data && Array.isArray(data.items)) ? data.items : [];
                if (rawItems.length === 0) break;

                const items = rawItems.filter(it => {
                    const status = (it.status || it.item_status || "").toLowerCase();
                    return status === "" || status === "active";
                });

                let hasNew = false;
                items.forEach(it => {
                    const id = it.item_id || it.id;
                    if (id && !seenIds.has(id)) {
                        seenIds.add(id);
                        allItems.push(it);
                        hasNew = true;
                    }
                });

                if (!hasNew && rawItems.length > 0 && page > 1) {
                    hasMore = false;
                    break;
                }

                if (rawItems.length < perPage) {
                    hasMore = false;
                } else {
                    page++;
                }
            } catch (err) {
                console.error("[Zoho] Fetch failed:", err);
                break;
            }
        }
        return allItems;
    }

    async function bootstrapZohoInventory() {
        setZohoLoading(true);
        try {
            const items = await fetchZohoItems();
            items.forEach(parseZohoItem);

            Object.keys(configState).forEach(pid => {
                const val = configState[pid];
                if (!val) return;
                const hasOptionMatch = (dynamicOptionsByPart[pid] || []).some(entry => (entry.hex || "").toLowerCase() === (val || "").toLowerCase());
                setPartPrice(pid, val, hasOptionMatch);
            });

            recomputeAvailableParts();
            buildPartsList();

            if (selectedPartId) {
                const selPartObj = ALL_PARTS.find(p => p.id === selectedPartId);
                if (!selPartObj || !isPartActive(selPartObj)) {
                    clearSelection();
                    resetColorPanel();
                    resetOptionsPanel();
                }
            }
            if (selectedPartId) {
                openColorPanelForPart(selectedPartId);
            }
            updateSummary();
        } catch (err) {
            console.error("[Zoho] Bootstrap failed:", err);
        } finally {
            setZohoLoading(false);
        }
    }


    const controllerWrapper = document.getElementById("controllerWrapper");
    const controllerArea = document.getElementById("controllerArea");
    const faceFrontEl = document.getElementById("controllerFaceFront");
    const faceBackEl = document.getElementById("controllerFaceBack");
    const faceFrontImg = faceFrontEl ? faceFrontEl.querySelector("img") : null;
    const faceBackImg = faceBackEl ? faceBackEl.querySelector("img") : null;

    if (faceFrontEl && faceFrontImg) faceFrontEl.style.setProperty("--controller-url", "url('" + faceFrontImg.getAttribute("src") + "')");
    if (faceBackEl && faceBackImg) faceBackEl.style.setProperty("--controller-url", "url('" + faceBackImg.getAttribute("src") + "')");

    const controllerFlipBtn = document.getElementById("controllerFlipBtn");
    const summaryAmountEl = document.getElementById("summaryAmount");
    const addToCartBtn = document.getElementById("addToCartBtn");
    const addToCartHome = addToCartBtn ? { parent: addToCartBtn.parentElement, next: addToCartBtn.nextSibling } : null;

    const colorPanelSub = document.getElementById("colorPanelSub");
    const colorPanelGrid = document.getElementById("colorPanelGrid");
    const optionsPanelGrid = document.getElementById("optionsPanelGrid");
    const colorPanelHeaderBottom = document.getElementById("colorPanelHeaderBottom");
    const colorEmptyState = document.getElementById("colorEmptyState");

    const partsLists = Array.from(document.querySelectorAll(".parts-list"));
    const primaryList = document.querySelector('.parts-list[data-list="primary"]');
    const secondaryList = document.querySelector('.parts-list[data-list="secondary"]');
    const accordionItems = Array.from(document.querySelectorAll(".accordion-item"));
    const partTooltip = document.getElementById("partTooltip");

    const navLangToggle = document.getElementById("langToggle");
    const mobileLangToggle = document.getElementById("mobileLangToggle");
    const navMenuBtn = document.querySelector(".nav-menu-btn");
    const mobileNavOverlay = document.getElementById("mobileNavOverlay");
    const mobileNavDrawer = document.getElementById("mobileNavDrawer");
    const configuratorControls = document.getElementById("configuratorControls");
    const panelButtons = configuratorControls ? configuratorControls.querySelectorAll("[data-panel]") : [];
    const panelSwitchButtons = document.querySelectorAll(".panel-switch-btn");
    const zohoLoadingOverlay = document.getElementById("zohoLoadingOverlay");
    const mobileOptionsDrawer = document.getElementById("mobileOptionsDrawer");
    const mobileOptionsGrid = document.getElementById("mobileOptionsGrid");
    const mobileQuery = window.matchMedia("(max-width: 900px)");
    let currentPanel = "colors";

    let currentSide = "front";
    let selectedPartId = null;
    let selectionPaletteMode = null;
    let hoverPartId = null;
    let tooltipVisible = false;

    const configState = {};
    const optionState = {};
    const selectedTransparencyByPart = {};
    let colorApplySeq = 0;
    const lastApplySeqByPart = {};
    ALL_PARTS.forEach(p => {
        configState[p.id] = null;
        optionState[p.id] = p.id === "backShellMain" ? "standard" : null;
        selectedTransparencyByPart[p.id] = false;
        lastApplySeqByPart[p.id] = 0;
    });

    function saveConfigToStorage() {
        const state = { configState, optionState };
        localStorage.setItem("ps5Config", JSON.stringify(state));
    }

    function loadConfigFromStorage() {
        try {
            const saved = localStorage.getItem("ps5Config");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.configState) Object.assign(configState, parsed.configState);
                if (parsed.optionState) Object.assign(optionState, parsed.optionState);
            }
        } catch (e) {
            console.warn("Storage load failed", e);
        }
    }
    loadConfigFromStorage();

    function setZohoLoading(isLoading) {
        if (!zohoLoadingOverlay) return;
        if (isLoading) {
            zohoLoadingOverlay.style.display = "flex";
            zohoLoadingOverlay.setAttribute("aria-hidden", "false");
        } else {
            zohoLoadingOverlay.style.display = "none";
            zohoLoadingOverlay.setAttribute("aria-hidden", "true");
        }
    }

    function setPanel(panel) {
        if (currentPanel === panel && selectedPartId && isMobileLayout()) {
            clearSelection();
            return;
        }
        currentPanel = panel;
        const mobile = isMobileLayout();
        selectionPaletteMode = mobile ? currentPanel : panel;

        document.body.classList.toggle("config-panel-options", panel === "options");
        document.body.classList.toggle("config-panel-colors", panel === "colors");

        panelButtons.forEach(btn => {
            btn.classList.toggle("active", btn.dataset.panel === panel);
            btn.setAttribute("aria-pressed", btn.dataset.panel === panel ? "true" : "false");
        });
        panelSwitchButtons.forEach(btn => {
            const isActive = btn.dataset.panel === panel;
            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-pressed", isActive ? "true" : "false");
        });

        if (!mobile && accordionItems.length >= 2) {
            accordionItems.forEach((item) => item.classList.add("open"));
            refreshAccordionHeights();
        }

        if (selectedPartId) {
            openColorPanelForPart(selectedPartId);
        } else {
            if (mobile) updateMobileOptionsBar();
        }

        if (mobile) {
            updateMobileOptionsBar();
        }
    }

    function isMobileLayout() {
        return mobileQuery && mobileQuery.matches;
    }

    function disableMobilePanels() {
        document.body.classList.remove("config-panel-options", "config-panel-colors");
        selectionPaletteMode = null;
        panelButtons.forEach(btn => {
            btn.classList.remove("active");
            btn.setAttribute("aria-pressed", "false");
        });
    }

    function setMobileActionBar(isMobile) {
        if (!addToCartBtn || !addToCartHome) return;
        if (addToCartBtn.parentElement !== addToCartHome.parent) {
            if (addToCartHome.next && addToCartHome.next.parentNode === addToCartHome.parent) {
                addToCartHome.parent.insertBefore(addToCartBtn, addToCartHome.next);
            } else {
                addToCartHome.parent.appendChild(addToCartBtn);
            }
        }
    }


    if (mobileSelectedPart) {
        mobileSelectedPart.addEventListener("click", () => {
            if (!isMobileLayout() || !selectedPartId) return;
            openColorPanelForPart(selectedPartId);
        });
    }

    panelSwitchButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const panel = btn.dataset.panel;
            if (!panel) return;
            setPanel(panel);
        });
    });

    if (configuratorControls) {
        configuratorControls.addEventListener("click", (e) => {
            if (!isMobileLayout()) return;
            const btn = e.target.closest(".control-btn");
            if (!btn) return;
            if (btn.dataset.action === "flip") {
                setSide(currentSide === "front" ? "back" : "front");
                playClick();
                return;
            }
            const panel = btn.dataset.panel;
            if (panel) setPanel(panel);
        });

        if (isMobileLayout()) {
            setPanel(currentPanel);
            setMobileActionBar(true);
        } else {
            disableMobilePanels();
            setMobileActionBar(false);
        }

        if (mobileQuery && mobileQuery.addEventListener) {
            mobileQuery.addEventListener("change", (e) => {
                if (e.matches) {
                    setPanel(currentPanel);
                    setMobileActionBar(true);
                } else {
                    disableMobilePanels();
                    setMobileActionBar(false);
                }
            });
        }
    }

    function toggleLanguage() {
        currentLang = currentLang === "ar" ? "en" : "ar";
        applyLanguage();
    }

    if (navLangToggle) navLangToggle.addEventListener("click", toggleLanguage);
    if (mobileLangToggle) mobileLangToggle.addEventListener("click", toggleLanguage);

    function setMobileNavOpen(isOpen) {
        if (!mobileNavOverlay || !mobileNavDrawer) return;
        mobileNavOverlay.classList.toggle("open", isOpen);
        mobileNavDrawer.classList.toggle("open", isOpen);
        document.body.classList.toggle("mobile-nav-open", isOpen);
        if (navMenuBtn) {
            navMenuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
        }
    }

    if (navMenuBtn) navMenuBtn.addEventListener("click", () => setMobileNavOpen(true));
    if (mobileNavOverlay) mobileNavOverlay.addEventListener("click", () => setMobileNavOpen(false));

    function applyLanguage() {
        document.documentElement.lang = currentLang;
        document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";

        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            const val = t(key);
            if (val) el.textContent = val;
        });
        document.querySelectorAll("[data-i18n-html]").forEach(el => {
            const key = el.getAttribute("data-i18n-html");
            const val = t(key);
            if (val) el.innerHTML = val;
        });

        const langToggleLabel = currentLang === "ar" ? "EN" : "AR";
        if (navLangToggle) navLangToggle.textContent = langToggleLabel;
        if (mobileLangToggle) mobileLangToggle.textContent = langToggleLabel;

        if (summaryAmountEl) updateSummary();
        buildPartsList();
        if (selectedPartId) openColorPanelForPart(selectedPartId);
    }

    function refreshAccordionHeights() {
        accordionItems.forEach(item => {
            const content = item.querySelector(".accordion-content");
            if (item.classList.contains("open")) {
                content.style.maxHeight = content.scrollHeight + "px";
            } else {
                content.style.maxHeight = "0";
            }
        });
    }

    function buildPartsList() {
        primaryList.innerHTML = "";
        secondaryList.innerHTML = "";

        const primaryIds = ["shell", "trimpiece", "sticks", "allButtons", "touchpad", "psButton"];
        const secondaryIds = ["backShellMain", "bumpersTriggers"];

        ALL_PARTS.forEach(part => {
            if (part.hiddenUI) return;
            const row = createPartRow(part);
            partsRowsById[part.id] = row;
            if (primaryIds.includes(part.id)) primaryList.appendChild(row);
            else secondaryList.appendChild(row);
        });
        refreshAccordionHeights();
    }

    function isPartActive(part) {
        return availablePartsSet.has(part.id);
    }

    function createPartRow(part) {
        const row = document.createElement("div");
        row.className = "part-row";
        row.dataset.id = part.id;
        if (!isPartActive(part)) row.classList.add("disabled");

        const iconBg = document.createElement("div");
        iconBg.className = "part-icon-bg";
        const icon = document.createElement("img");
        icon.src = part.icon;
        icon.alt = "";
        iconBg.appendChild(icon);

        const name = document.createElement("div");
        name.className = "part-name";
        name.textContent = getPartLabel(part.id);

        const status = document.createElement("div");
        status.className = "part-status";

        row.appendChild(iconBg);
        row.appendChild(name);
        row.appendChild(status);

        row.addEventListener("click", () => {
            if (!isPartActive(part)) return;
            selectPart(part.id);
        });
        return row;
    }

    function selectPart(partId) {
        if (selectedPartId === partId) {
            clearSelection();
            return;
        }
        playClick();
        selectedPartId = partId;
        const part = ALL_PARTS.find(p => p.id === partId);
        if (part && part.side !== currentSide) {
            setSide(part.side);
        }
        updatePartsUI();
        openColorPanelForPart(partId);
    }

    function updatePartsUI() {
        Object.keys(partsRowsById).forEach(id => {
            const row = partsRowsById[id];
            row.classList.toggle("active", id === selectedPartId);

            const status = row.querySelector(".part-status");
            if (status) {
                const color = configState[id];
                const option = optionState[id];
                let statusText = "";
                if (option && option !== "standard") {
                    const optObj = (dynamicOptionsByPart[id] || []).find(o => o.key === option);
                    if (optObj && optObj.isGamemode && optObj.price != null) {
                        statusText = i18n[currentLang].currencyPrefix + optObj.price.toFixed(2);
                    } else {
                        statusText = t("option_" + option);
                    }
                }
                else if (color) {
                    const colObj = (dynamicColorsByPart[id] || []).find(c => c.key === color);
                    if (colObj) {
                        if (colObj.hex.startsWith("#")) statusText = colObj.hex;
                        else statusText = t("color_" + colObj.key);
                    }
                }
                status.textContent = statusText;
            }
        });
    }

    function clearSelection() {
        selectedPartId = null;
        updatePartsUI();
        resetColorPanel();
        resetOptionsPanel();
        if (isMobileLayout()) updateMobileOptionsBar();
    }

    function resetColorPanel() {
        colorPanelHeaderBottom.style.display = "none";
        colorPanelGrid.style.display = "none";
        colorEmptyState.style.display = "flex";
    }
    function resetOptionsPanel() {
        optionsPanelGrid.innerHTML = "";
    }

    function openColorPanelForPart(partId) {
        const part = ALL_PARTS.find(p => p.id === partId);
        if (!part) return;

        const palette = getPaletteForPart(partId);
        const options = getOptionsForPart(partId);

        const mobile = isMobileLayout();
        if (!mobile) {
            colorEmptyState.style.display = "none";
            colorPanelHeaderBottom.style.display = "flex";
            colorPanelGrid.style.display = "grid";

            buildPaletteCells(colorPanelGrid, palette, false);
            buildPaletteCells(optionsPanelGrid, options, true);
        } else {
            updateMobileOptionsBar();
        }
    }

    function updateMobileOptionsBar() {
        if (!mobileOptionsGrid) return;
        const partId = selectedPartId;
        const palette = partId ? getPaletteForPart(partId) : [];
        const options = partId ? getOptionsForPart(partId) : [];

        mobileOptionsGrid.innerHTML = "";

        const combined = [];
        options.forEach(o => combined.push({ ...o, isOption: true }));
        palette.forEach(c => combined.push({ ...c, isOption: false }));

        if (combined.length === 0) {
            mobileOptionsGrid.classList.remove("has-content");
            return;
        }
        mobileOptionsGrid.classList.add("has-content");

        combined.forEach(entry => {
            const cell = document.createElement("div");
            cell.className = "mobile-option-cell";
            if (entry.isOption) {
                const isSelected = optionState[partId] === entry.key;
                cell.classList.toggle("active", isSelected);
                const label = entry.isGamemode && entry.price != null
                    ? (i18n[currentLang].currencyPrefix + entry.price.toFixed(2))
                    : t("option_" + entry.key);
                cell.innerHTML = '<div class="opt-label">' + label + '</div>';
                cell.addEventListener("click", () => applyOption(partId, entry.key));
            } else {
                const isSelected = configState[partId] === entry.key;
                cell.classList.toggle("active", isSelected);
                cell.style.backgroundColor = entry.hex;
                cell.addEventListener("click", () => applyColor(partId, entry.key));
            }
            mobileOptionsGrid.appendChild(cell);
        });
    }

    function buildPaletteCells(target, entries, isOption) {
        target.innerHTML = "";
        const partId = selectedPartId;
        if (!partId) return;

        entries.forEach(entry => {
            const cell = document.createElement("div");
            cell.className = "color-cell";
            const isSelected = isOption ? (optionState[partId] === entry.key) : (configState[partId] === entry.key);
            cell.classList.toggle("active", isSelected);

            if (isOption) {
                cell.classList.add("option-cell");
                cell.textContent = entry.isGamemode && entry.price != null
                    ? (i18n[currentLang].currencyPrefix + entry.price.toFixed(2))
                    : t("option_" + entry.key);
                cell.addEventListener("click", () => applyOption(partId, entry.key));
            } else {
                cell.style.backgroundColor = entry.hex;
                cell.title = t("color_" + entry.key);
                cell.addEventListener("click", () => applyColor(partId, entry.key));
            }
            target.appendChild(cell);
        });
    }

    function applyColor(partId, colorKey) {
        playClick2();
        configState[partId] = colorKey;
        saveConfigToStorage();

        const palette = getPaletteForPart(partId);
        const colObj = palette.find(c => c.key === colorKey);

        if (partId === "backShellMain") {
            optionState[partId] = "standard";
        }

        if (colObj) {
            selectedTransparencyByPart[partId] = !!colObj.isTransparent;
            setPartPrice(partId, colorKey, false);
        }

        updatePartsUI();
        updateSummary();
        applyOptions();
        if (selectedPartId === partId) openColorPanelForPart(partId);
    }

    function applyOption(partId, optionKey) {
        playClick2();
        optionState[partId] = optionKey;
        saveConfigToStorage();

        setPartPrice(partId, optionKey, true);

        updatePartsUI();
        updateSummary();
        applyOptions();
        if (selectedPartId === partId) openColorPanelForPart(partId);
    }

    function setPartPrice(partId, key, isOption) {
        const palette = isOption ? getOptionsForPart(partId) : getPaletteForPart(partId);
        const entry = palette.find(e => e.key === key);
        if (isOption) {
            selectedOptionPriceByPart[partId] = (entry && entry.price != null) ? entry.price : 0;
        } else {
            selectedPriceByPart[partId] = (entry && entry.price != null) ? entry.price : 0;
        }
    }

    function applyOptions() {
        const side = currentSide;
        const nonce = ++colorApplySeq;

        const pShell = configState["shell"];
        const pTrim = configState["trimpiece"];
        const pSticks = configState["sticks"];
        const pButtons = configState["allButtons"];
        const pTouch = configState["touchpad"];
        const pPs = configState["psButton"];
        const pBackShell = configState["backShellMain"];
        const pBackTriggers = configState["bumpersTriggers"];

        const oBackShell = optionState["backShellMain"];
        const oButtons = optionState["allButtons"];

        const shellHex = getHex("shell", pShell);
        const trimHex = getHex("trimpiece", pTrim);
        const sticksHex = getHex("sticks", pSticks);
        const buttonsHex = getHex("allButtons", pButtons);
        const touchHex = getHex("touchpad", pTouch);
        const psHex = getHex("psButton", pPs);
        const backShellHex = getHex("backShellMain", pBackShell);
        const backTriggersHex = getHex("bumpersTriggers", pBackTriggers);

        const shellTrans = selectedTransparencyByPart["shell"];
        const trimTrans = selectedTransparencyByPart["trimpiece"];
        const touchTrans = selectedTransparencyByPart["touchpad"];
        const backShellTrans = selectedTransparencyByPart["backShellMain"];

        if (side === "front") {
            updateLayer("shell", shellHex, shellTrans, nonce);
            updateLayer("trimpiece", trimHex, trimTrans, nonce);
            updateLayer("sticks", sticksHex, false, nonce);
            updateLayer("allButtons", buttonsHex, false, nonce);
            updateLayer("touchpad", touchHex, touchTrans, nonce);
            updateLayer("psButton", psHex, false, nonce);
            updateLayer("bumpersTriggers", backTriggersHex, false, nonce);

            const isPartTransparent = (pid) => {
                const key = configState[pid];
                if (!key) return false;
                if (key.toLowerCase().endsWith("_t")) return true;
                const palette = getPaletteForPart(pid);
                const col = palette.find(c => c.key === key);
                if (col && col.isTransparent) return true;
                const hex = col ? col.hex : (key.startsWith("#") ? key : null);
                if (hex && TRANSPARENT_HEXES.has(hex.toLowerCase())) return true;
                return false;
            };

            const anyTransFront = isPartTransparent("shell") || isPartTransparent("trimpiece") || isPartTransparent("touchpad");
            const shellOverlay = document.getElementById("overlay-shell");
            const trimOverlay = document.getElementById("overlay-trim");
            const touchOverlay = document.getElementById("overlay-touchpad");
            if (shellOverlay) shellOverlay.style.display = "none";
            if (trimOverlay) trimOverlay.style.display = "none";
            if (touchOverlay) touchOverlay.style.display = "none";

            if (faceFrontImg) {
                faceFrontImg.src = "/assets/controller.png";
            }
        } else {
            if (faceBackImg) {
                faceBackImg.src = "/assets/controller_back.png";
            }

            updateLayer("backShellMain", backShellHex, backShellTrans, nonce);
            updateLayer("bumpersTriggers", backTriggersHex, false, nonce);
        }
    }

    function getHex(partId, key) {
        if (!key) return null;
        const palette = getPaletteForPart(partId);
        const entry = palette.find(e => e.key === key);
        return entry ? entry.hex : null;
    }

    function updateLayer(partId, hex, isTransparent, nonce) {
        const part = ALL_PARTS.find(p => p.id === partId && p.side === currentSide);
        if (!part) return;

        const container = currentSide === "front" ? faceFrontEl : faceBackEl;
        if (!container) return;

        let layerGroup = container.querySelector('.layer-group[data-part="' + partId + '"]');
        if (!layerGroup) {
            layerGroup = document.createElement("div");
            layerGroup.className = "layer-group";
            layerGroup.dataset.part = partId;
            container.appendChild(layerGroup);
        }

        if (!hex) {
            layerGroup.innerHTML = "";
            return;
        }

        const masks = Array.isArray(part.mask) ? part.mask : [part.mask];
        layerGroup.innerHTML = "";

        masks.forEach(maskUrl => {
            const img = document.createElement("img");
            img.src = maskUrl;
            img.style.backgroundColor = hex;
            img.style.webkitMaskImage = "url(" + maskUrl + ")";
            img.style.maskImage = "url(" + maskUrl + ")";

            if (isTransparent) {
                img.style.mixBlendMode = "multiply";
                img.style.opacity = String(TRANSPARENT_TINT_OPACITY);
            } else {
                img.style.mixBlendMode = "normal";
                img.style.opacity = "1";
            }
            layerGroup.appendChild(img);
        });
    }

    function setSide(side) {
        currentSide = side;
        if (controllerFlip) {
            controllerFlip.classList.toggle("flipped", side === "back");
            controllerFlip.setAttribute("aria-label", side === "front" ? t("front") : t("back"));
        }
        if (controllerFlipBtn) {
            controllerFlipBtn.classList.toggle("flipped", side === "back");
            controllerFlipBtn.setAttribute("aria-label", side === "front" ? t("front") : t("back"));
        }
        applyOptions();
    }

    if (controllerFlipBtn) {
        controllerFlipBtn.addEventListener("click", () => {
            setSide(currentSide === "front" ? "back" : "front");
            playClick();
        });
    }

    function updateSummary() {
        let total = baseControllerPrice || 0;
        ALL_PARTS.forEach(p => {
            total += (selectedPriceByPart[p.id] || 0);
            total += (selectedOptionPriceByPart[p.id] || 0);
        });

        const formatted = i18n[currentLang].currencyPrefix + total.toFixed(2);
        if (summaryAmountEl) summaryAmountEl.textContent = formatted;
        const alt = document.getElementById("summaryAmountAlt");
        if (alt) alt.textContent = formatted;
    }

    function clearAllSelections() {
        ALL_PARTS.forEach(p => {
            configState[p.id] = null;
            optionState[p.id] = (p.id === "backShellMain") ? "standard" : null;
            selectedPriceByPart[p.id] = 0;
            selectedOptionPriceByPart[p.id] = 0;
        });

        // Clear all layers
        Object.keys(layers).forEach(pid => {
            const layerGroup = document.querySelector('.layer-group[data-part="' + pid + '"]');
            if (layerGroup) layerGroup.innerHTML = "";
        });

        saveConfigToStorage();
        applyOptions();
        updateSummary();
        updatePartsUI();
        if (selectedPartId) openColorPanelForPart(selectedPartId);
        else if (isMobileLayout()) updateMobileOptionsBar();
    }

    const clearBtn = document.getElementById("clearSelectionBtn");
    if (clearBtn) {
        clearBtn.addEventListener("click", clearAllSelections);
    }

    function getSnapshot() {
        const snapshot = {
            parts: {},
            total: 0,
            basePrice: baseControllerPrice
        };
        ALL_PARTS.forEach(part => {
            const colorKey = configState[part.id];
            const optionKey = optionState[part.id];
            const palette = getPaletteForPart(part.id);
            const options = getOptionsForPart(part.id);

            const colorObj = palette.find(c => c.key === colorKey);
            const optionObj = options.find(o => o.key === optionKey);

            // Robust transparency check for snapshot
            const isTrans = colorKey && (colorKey.toLowerCase().endsWith("_t") || (colorObj && colorObj.isTransparent));

            snapshot.parts[part.id] = {
                color: colorObj ? { ...colorObj } : null,
                option: optionObj ? { ...optionObj } : null,
                transparency: !!isTrans
            };
        });

        let sum = baseControllerPrice;
        Object.keys(selectedPriceByPart).forEach(k => sum += selectedPriceByPart[k]);
        Object.keys(selectedOptionPriceByPart).forEach(k => sum += selectedOptionPriceByPart[k]);
        snapshot.total = sum;

        return snapshot;
    }

    function buildPreviewSvg(snapshot, side) {
        const width = BASE_WIDTH;
        const height = BASE_HEIGHT;
        const parts = side === "front" ? FRONT_PARTS : BACK_PARTS;
        const overlays = [];
        const origin = window.location.origin;

        const anyTransFront = (side === "front") && (
            snapshot.parts["shell"].transparency ||
            snapshot.parts["trimpiece"].transparency ||
            snapshot.parts["touchpad"].transparency
        );

        let ctrlSrc = "";
        if (side === "front") {
            ctrlSrc = "/assets/controller.png";
        } else {
            ctrlSrc = "/assets/controller_back.png";
        }

        parts.forEach((part) => {
            const state = snapshot.parts[part.id];
            if (!state) return;

            const optionImage = state.option && state.option.image ? state.option.image : null;
            const colorImage = state.color && state.color.image ? state.color.image : null;
            const overlayImage = optionImage || colorImage;
            if (!overlayImage) return;

            const fullOverlayUrl = overlayImage.startsWith("http") ? overlayImage : (origin + "/" + overlayImage.replace(new RegExp("^/+"), ""));
            overlays.push(
                '<image href="' + fullOverlayUrl + '" x="0" y="0" width="' + width + '" height="' + height + '" preserveAspectRatio="xMidYMid meet" />'
            );
        });

        const fullCtrlSrc = ctrlSrc.startsWith("http") ? ctrlSrc : (origin + "/" + ctrlSrc.replace(new RegExp("^/+"), ""));

        const svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" style="background:#141829; shape-rendering: geometricPrecision; display: block; width: 100%; height: auto;">' +
            '<image href="' + fullCtrlSrc + '" x="0" y="0" width="' + width + '" height="' + height + '" preserveAspectRatio="xMidYMid meet" opacity="0.98" />' +
            overlays.join("") +
            '</svg>';

        return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
    }

    if (addToCartBtn) {
        addToCartBtn.addEventListener("click", () => {
            const snapshot = getSnapshot();
            const hasCustom = Object.values(snapshot.parts).some(p => p.color || (p.option && p.option.key !== "standard"));
            if (!hasCustom) {
                alert(t("alertNone"));
                return;
            }

            const previewFront = buildPreviewSvg(snapshot, "front");
            const previewBack = buildPreviewSvg(snapshot, "back");

            const cartItem = {
                id: Date.now(),
                name: t("productName"),
                total: snapshot.total,
                parts: snapshot.parts,
                previewFront: previewFront,
                previewBack: previewBack
            };

            const cart = JSON.parse(localStorage.getItem("ezCart") || "[]");
            cart.push(cartItem);
            localStorage.setItem("ezCart", JSON.stringify(cart));
            window.location.href = "/cart";
        });
    }

    bootstrapZohoInventory();
    setPanel(currentPanel);

})();
