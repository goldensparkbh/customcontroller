
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
    const zohoFetchError = { hasError: false, message: "" };

    // Persistent state
    let baseControllerPrice = 0;
    const partsRowsById = {};
    let selectedPartId = null;
    let currentPanel = "colors";
    const configState = {};
    const optionState = {};
    const selectedTransparencyByPart = {};
    let selectionPaletteMode = null;
    let currentSide = "front";
    let hoverPartId = null;
    let tooltipVisible = false;
    let availablePartsSet = new Set();
    const lastApplySeqByPart = {};
    const layers = {};
    const maskDataById = {};
    let masksReady = false;

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
        standard: { hex: "#FFFFFF", icon: "/assets/icons/sticks_standard.png" },
        halleffect: { hex: "#FFD700", icon: "/assets/icons/sticks_halleffect.png" },
        tmr: { hex: "#00BFFF", icon: "/assets/icons/sticks_tmr.png" },
        digital: { hex: "#FFFFFF" },
        rampkit: { hex: "#FFFFFF", icon: "/assets/icons/backShellMain_rampkit.png" },
        clicky: { hex: "#FFFFFF" }
    };

    // Special case for backShellMain standard icon
    const BACK_SHELL_STANDARD_ICON = "/assets/icons/backShellMain_standard.png";

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
            const basePrice = (typeof item.rate === "number" ? item.rate : (parseFloat(item.rate) || parseFloat(item.unit_price) || 0)) || 0;
            if (!Number.isNaN(basePrice) && basePrice > 0) {
                baseControllerPrice = basePrice;
                log.reason = "Base controller price found: " + basePrice;
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
        const price = (typeof item.rate === "number" ? item.rate : parseFloat(item.rate)) || 0;
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
                const isTransparent = (partId === "allButtons") ? false : (typeof transparencyHint === "boolean"
                    ? transparencyHint
                    : TRANSPARENT_HEXES.has(col.hex.toLowerCase()));

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
                // Apply specific icons for backShellMain gamemode options
                if (partId === "backShellMain") {
                    if (opt.key === "standard") opt.icon = "/assets/icons/backShellMain_standard.png";
                    else if (opt.key === "rampkit") opt.icon = "/assets/icons/backShellMain_rampkit.png";
                }
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

            // Auto-select a part on first load to show options in the palette
            if (!selectedPartId) {
                if (availablePartsSet.has("shell")) {
                    selectPart("shell");
                } else if (availablePartsSet.size > 0) {
                    // Filter out hidden parts if any, or just pick the first available
                    const firstId = Array.from(availablePartsSet)[0];
                    selectPart(firstId);
                }
            }
        }
    }


    const controllerWrapper = document.getElementById("controllerWrapper");
    const controllerArea = document.getElementById("controllerArea");
    const faceFrontEl = document.getElementById("controllerFaceFront");
    const faceBackEl = document.getElementById("controllerFaceBack");
    const faceFrontImg = faceFrontEl ? faceFrontEl.querySelector("img") : null;
    const faceBackImg = faceBackEl ? faceBackEl.querySelector("img") : null;

    const overlayShellImg = document.getElementById("overlay-shell");
    const overlayTrimImg = document.getElementById("overlay-trim");
    const overlayTouchpadImg = document.getElementById("overlay-touchpad");

    if (faceFrontEl && faceFrontImg) faceFrontEl.style.setProperty("--controller-url", "url('" + faceFrontImg.getAttribute("src") + "')");
    if (faceBackEl && faceBackImg) faceBackEl.style.setProperty("--controller-url", "url('" + faceBackImg.getAttribute("src") + "')");

    const controllerFlip = document.getElementById("controllerFlip");
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

    function buildPartLayers() {
        ALL_PARTS.forEach(part => {
            const layer = document.createElement("div");
            layer.className = "part-layer";
            layer.dataset.partId = part.id;

            const maskUrls = Array.isArray(part.mask) ? part.mask : [part.mask];
            const maskString = maskUrls.map(u => "url('" + u + "')").join(", ");
            layer.style.setProperty("--mask-url", maskString);

            if (part.side === "front") faceFrontEl.appendChild(layer);
            else faceBackEl.appendChild(layer);

            if (!layers[part.id]) layers[part.id] = [];
            layers[part.id].push(layer);
        });
    }
    buildPartLayers();

    function loadMask(part) {
        return new Promise(resolve => {
            const firstMask = Array.isArray(part.mask) ? part.mask[0] : part.mask;
            const img = new Image();
            img.src = firstMask;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                maskDataById[part.id] = {
                    width: canvas.width,
                    height: canvas.height,
                    data: imageData.data
                };
                resolve();
            };
            img.onerror = () => resolve();
        });
    }

    (async function () {
        for (const part of ALL_PARTS) await loadMask(part);
        masksReady = true;
    })();

    const mobileOptionsGrid = document.getElementById("mobileOptionsGrid");
    const mobileQuery = window.matchMedia("(max-width: 900px)");
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

    function syncBaseImages() {
        if (!faceFrontImg || !faceBackImg) return;

        // --- FRONT SIDE LOGIC ---
        // Definition of "Core" front parts that affect the base image
        const coreParts = ["shell", "trimpiece", "touchpad"];

        // Helper to check if a part is currently transparent
        const isPartTransparent = (pid) => {
            if (pid === "allButtons") return false;
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

        const transStatus = {
            shell: isPartTransparent("shell"),
            trimpiece: isPartTransparent("trimpiece"),
            touchpad: isPartTransparent("touchpad")
        };

        const anyTrans = transStatus.shell || transStatus.trimpiece || transStatus.touchpad;
        const allTrans = transStatus.shell && transStatus.trimpiece && transStatus.touchpad;
        const anySolid = !transStatus.shell || !transStatus.trimpiece || !transStatus.touchpad;

        let frontSrc = "/assets/controller.png";

        // Case 1: All Solid -> controller.png (already default)
        // Case 2: All Transparent -> controller_t.png
        // Case 3: Mixed -> controller_t.png + specific solid overlays

        if (anyTrans) {
            frontSrc = "/assets/controller_t.png";
        }

        if (faceFrontImg.getAttribute("src") !== frontSrc) {
            faceFrontImg.src = frontSrc;
        }

        // Overlay Visibility (Mixed case logic)
        // Only show overlays if we are using the transparent base (controller_t.png)
        // AND the specific part is SOLID.
        if (anyTrans) {
            if (overlayShellImg) overlayShellImg.style.display = transStatus.shell ? "none" : "block";
            if (overlayTrimImg) overlayTrimImg.style.display = transStatus.trimpiece ? "none" : "block";
            if (overlayTouchpadImg) overlayTouchpadImg.style.display = transStatus.touchpad ? "none" : "block";
        } else {
            // All solid -> Hide all overlays because controller.png already has them
            if (overlayShellImg) overlayShellImg.style.display = "none";
            if (overlayTrimImg) overlayTrimImg.style.display = "none";
            if (overlayTouchpadImg) overlayTouchpadImg.style.display = "none";
        }

        // --- BACK SIDE LOGIC ---
        const isBackRamp = optionState["backShellMain"] === "rampkit";
        const isBackTrans = isPartTransparent("backShellMain");

        let backSrc = "/assets/controller_back.png";
        if (isBackRamp) {
            backSrc = "/assets/controller_back_ramp.png";
            (layers["backShellMain"] || []).forEach(l => l.style.display = "none");
        } else {
            if (isBackTrans) {
                backSrc = "/assets/controller_back_t.png";
            }
            if (configState["backShellMain"]) {
                (layers["backShellMain"] || []).forEach(l => l.style.display = "block");
            }
        }

        if (faceBackImg.getAttribute("src") !== backSrc) {
            faceBackImg.src = backSrc;
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
            if (val && el) el.innerHTML = val;
        });

        const langToggleLabel = currentLang === "ar" ? "EN" : "AR";
        if (navLangToggle) navLangToggle.textContent = langToggleLabel;
        if (mobileLangToggle) mobileLangToggle.textContent = langToggleLabel;

        if (summaryAmountEl) updateSummary();
        buildPartsList();
        if (selectedPartId) openColorPanelForPart(selectedPartId);
    }

    function refreshAccordionHeights() {
        if (!accordionItems) return;
        accordionItems.forEach(item => {
            const content = item.querySelector(".accordion-content");
            if (content) {
                if (item.classList.contains("open")) {
                    content.style.maxHeight = content.scrollHeight + "px";
                } else {
                    content.style.maxHeight = "0";
                }
            }
        });
    }

    function buildPartsList() {
        if (primaryList) primaryList.innerHTML = "";
        if (secondaryList) secondaryList.innerHTML = "";

        ALL_PARTS.forEach(part => {
            if (part.hiddenUI) return;
            const row = createPartRow(part);
            partsRowsById[part.id] = row;
            if (primaryList) primaryList.appendChild(row);
        });
        refreshAccordionHeights();
    }

    function isPartActive(part) {
        return availablePartsSet.has(part.id);
    }

    function createPartRow(part) {
        const row = document.createElement("div");
        row.className = "parts-item";
        row.dataset.id = part.id;
        if (!isPartActive(part)) row.classList.add("disabled");

        const thumb = document.createElement("div");
        thumb.className = "parts-thumb";
        const icon = document.createElement("img");
        icon.src = part.icon;
        icon.alt = "";
        thumb.appendChild(icon);

        row.appendChild(thumb);
        // Only icon, no name or status

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
        // Prefer the non-hidden side for the UI selection
        const part = ALL_PARTS.find(p => p.id === partId && !p.hiddenUI) || ALL_PARTS.find(p => p.id === partId);
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
                if (option && option !== "standard") statusText = t("option_" + option);
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
        Object.values(layers).forEach(layerArr => {
            if (Array.isArray(layerArr)) {
                layerArr.forEach(l => l.classList.remove("selected"));
            }
        });

        if (isMobileLayout()) updateMobileOptionsBar();
    }

    function resetColorPanel() {
        colorPanelHeaderBottom.style.display = "none";
        colorPanelGrid.style.display = "none";
        colorEmptyState.style.display = "flex";
    }
    function resetOptionsPanel() {
        if (optionsPanelGrid) optionsPanelGrid.innerHTML = "";
    }

    function openColorPanelForPart(partId) {
        const part = ALL_PARTS.find(p => p.id === partId);
        if (!part) return;

        const palette = getPaletteForPart(partId);
        const options = getOptionsForPart(partId);
        const isBackRamp = (partId === "backShellMain" && optionState["backShellMain"] === "rampkit");

        // Always show the panel for both mobile and desktop
        colorEmptyState.style.display = "none";

        const mobile = isMobileLayout();
        if (mobile) {
            // Mobile: Show both grids in one scrollable panel
            optionsPanelGrid.style.display = options.length > 0 ? "grid" : "none";
            colorPanelGrid.style.display = isBackRamp ? "none" : "grid";
            colorPanelHeaderBottom.style.display = "none"; // Hide redundant "Aesthetics" header

            buildPaletteCells(optionsPanelGrid, options, true);
            buildPaletteCells(colorPanelGrid, isBackRamp ? [] : palette, false);

            // Hide the tab switch buttons on mobile if they exist
            document.querySelectorAll(".panel-switch-btn").forEach(btn => btn.style.display = "none");

            updateMobileOptionsBar();
        } else {
            // Desktop: build both
            colorPanelHeaderBottom.style.display = "flex";
            colorPanelGrid.style.display = isBackRamp ? "none" : "grid";
            optionsPanelGrid.style.display = options.length > 0 ? "grid" : "none";
            buildPaletteCells(colorPanelGrid, isBackRamp ? [] : palette, false);
            buildPaletteCells(optionsPanelGrid, options, true);
        }
    }

    function updateMobileOptionsBar() {
        if (!mobileOptionsGrid) return;
        mobileOptionsGrid.innerHTML = "";
        ALL_PARTS.forEach(part => {
            if (part.hiddenUI || !isPartActive(part)) return;
            const cell = document.createElement("div");
            cell.className = "mobile-part-item";

            const btn = document.createElement("button");
            btn.className = "mobile-part-btn";
            if (selectedPartId === part.id) btn.classList.add("selected");
            const img = document.createElement("img");
            img.src = part.icon;
            btn.appendChild(img);

            btn.addEventListener("click", () => selectPart(part.id));
            cell.appendChild(btn);
            mobileOptionsGrid.appendChild(cell);
        });

        if (mobileOptionsGrid.children.length === 0) {
            mobileOptionsGrid.classList.remove("has-content");
        } else {
            mobileOptionsGrid.classList.add("has-content");
        }
    }



    function buildPaletteCells(target, entries, isOption) {
        if (target) target.innerHTML = "";
        const partId = selectedPartId;
        if (!partId) return;

        if (isOption) {
            if (entries.length > 0) {
                renderSection(target, entries, t("availableOptions"), true);
            }
        } else {
            const isAllButtons = (partId === "allButtons");
            const solid = entries.filter(e => isAllButtons || (!e.isTransparent && !TRANSPARENT_HEXES.has(e.hex.toLowerCase())));
            const trans = isAllButtons ? [] : entries.filter(e => e.isTransparent || TRANSPARENT_HEXES.has(e.hex.toLowerCase()));

            if (solid.length > 0) renderSection(target, solid, t("solidColors"), false);
            if (trans.length > 0) renderSection(target, trans, t("transparentColors"), false);
        }
    }

    function renderSection(target, entries, title, isOption) {
        if (title) {
            const header = document.createElement("div");
            header.className = isMobileLayout() ? "mobile-group-title" : "color-group-title";
            header.textContent = title;
            target.appendChild(header);
        }

        const partId = selectedPartId;
        entries.forEach(entry => {
            const cell = document.createElement("div");
            cell.className = isOption ? "cd-cell-op" : "cd-cell";
            const isSelected = isOption ? (optionState[partId] === entry.key) : (configState[partId] === entry.key);
            cell.classList.toggle("active", isSelected);

            const swatch = document.createElement("div");
            swatch.className = isOption ? "cd-swatch-op" : "cd-swatch";
            if (entry.icon) {
                swatch.style.backgroundImage = `url('${entry.icon}')`;
                swatch.style.backgroundSize = "cover";
                swatch.style.backgroundColor = "transparent";
            } else {
                swatch.style.backgroundColor = entry.hex;
            }

            const shouldShowPriceInside = entry.price != null && entry.price > 0 && entry.key !== "rampkit";
            if (shouldShowPriceInside) {
                const priceLabel = document.createElement("span");
                priceLabel.className = "swatch-price";
                priceLabel.textContent = i18n[currentLang].currencyPrefix + entry.price;
                swatch.appendChild(priceLabel);
            }

            cell.appendChild(swatch);

            if (isOption) {
                const label = document.createElement("div");
                label.className = "cd-color-name";
                const labelText = entry.isGamemode && entry.price != null
                    ? (i18n[currentLang].currencyPrefix + entry.price.toFixed(2))
                    : t("option_" + entry.key);
                label.textContent = labelText;
                cell.appendChild(label);
            }

            cell.addEventListener("click", () => {
                if (isOption) applyOption(partId, entry.key);
                else applyColor(partId, entry.key);
            });
            target.appendChild(cell);
        });
    }

    function applyColor(partId, colorKey) {
        playClick2();
        configState[partId] = colorKey;

        const palette = getPaletteForPart(partId);
        const colObj = palette.find(c => c.key === colorKey);


        if (colObj) {
            setPartPrice(partId, colorKey, false);
            saveConfigToStorage();
            const targetLayers = layers[partId] || [];
            targetLayers.forEach(layer => {
                layer.style.setProperty("--tint", colObj.hex);
                const isActuallyTransparent = (colObj.isTransparent || TRANSPARENT_HEXES.has(colObj.hex.toLowerCase())) && partId !== "allButtons";
                if (isActuallyTransparent) {
                    layer.style.setProperty("--tint-opacity", String(TRANSPARENT_TINT_OPACITY));
                    layer.style.mixBlendMode = "multiply";
                    layer.style.backgroundImage = "none";
                } else {
                    layer.style.setProperty("--tint-opacity", "1");
                    // Face buttons should be opaque as requested
                    if (partId === "allButtons") {
                        layer.style.mixBlendMode = "normal";
                        layer.style.backgroundImage = "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.2) 0%, transparent 60%)";
                    } else {
                        layer.style.mixBlendMode = "multiply";
                        layer.style.backgroundImage = "none";
                    }
                }
                layer.style.display = "block";
            });
        }

        updatePartsUI();
        syncBaseImages();
        updateSummary();
        if (selectedPartId === partId) openColorPanelForPart(partId);
    }

    function applyOption(partId, optionKey) {
        playClick2();
        optionState[partId] = optionKey;

        const options = getOptionsForPart(partId);
        const optObj = options.find(o => o.key === optionKey);

        setPartPrice(partId, optionKey, true);
        saveConfigToStorage();

        const isStickTech = partId === "sticks" && (optionKey === "standard" || optionKey === "halleffect" || optionKey === "tmr");

        if (optObj && optObj.hex && !isStickTech) {
            const targetLayers = layers[partId] || [];
            targetLayers.forEach(layer => {
                layer.style.setProperty("--tint", optObj.hex);
                layer.style.setProperty("--tint-opacity", "1");
                if (partId === "allButtons") {
                    layer.style.mixBlendMode = "normal";
                    layer.style.backgroundImage = "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.2) 0%, transparent 60%)";
                } else {
                    layer.style.mixBlendMode = "multiply";
                    layer.style.backgroundImage = "none";
                }
                layer.style.display = "block";
            });
        }

        if (partId === "backShellMain" && optionKey === "rampkit") {
            (layers["backShellMain"] || []).forEach(l => l.style.display = "none");
        }

        updatePartsUI();
        syncBaseImages();
        updateSummary();
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

    function setSide(side) {
        if (side === currentSide) return;
        currentSide = side;

        if (currentSide === "back") {
            if (controllerWrapper) controllerWrapper.classList.add("is-back");
        } else {
            if (controllerWrapper) controllerWrapper.classList.remove("is-back");
        }

        if (controllerFlip) {
            controllerFlip.classList.toggle("flipped", side === "back");
        }
        if (controllerFlipBtn) {
            controllerFlipBtn.classList.toggle("flipped", side === "back");
        }
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
        if (!confirm(t("alertConfirmClear") || "Clear all selections?")) return;
        ALL_PARTS.forEach(p => {
            configState[p.id] = null;
            optionState[p.id] = (p.id === "backShellMain") ? "standard" : null;
            selectedPriceByPart[p.id] = 0;
            selectedOptionPriceByPart[p.id] = 0;
        });

        // Hide all layers
        Object.keys(layers).forEach(pid => {
            (layers[pid] || []).forEach(layer => {
                layer.style.display = "none";
            });
        });

        saveConfigToStorage();
        syncBaseImages();
        updateSummary();
        updatePartsUI();
        if (selectedPartId) openColorPanelForPart(selectedPartId);
        else if (isMobileLayout()) updateMobileOptionsBar();
    }

    const clearBtn = document.getElementById("clearSelectionBtn");
    if (clearBtn) clearBtn.addEventListener("click", clearAllSelections);

    function getSnapshot() {
        const snapshot = {
            parts: {},
            total: 0,
            basePrice: parseFloat(baseControllerPrice) || 0
        };
        const ID_MAPPING = {
            allButtons: ["faceButtons", "psButton", "share", "options"],
            sticks: ["stickL", "stickR"],
            bumpersTriggers: ["bumpers", "triggers", "backTriggers", "ls", "rs", "l2r2"]
        };

        ALL_PARTS.forEach(part => {
            const pid = part.id;
            const colorKey = configState[pid];
            const optionKey = optionState[pid];
            const palette = getPaletteForPart(pid);
            const options = getOptionsForPart(pid);

            // Robust color finding: Key match, Hex match, or key match (ignoring suffix)
            let colorObj = palette.find(c => c.key === colorKey) ||
                palette.find(c => c.hex === colorKey) ||
                palette.find(c => (c.key || "").split("_")[0] === (colorKey || "").split("_")[0]);

            // If still not found, try mapping
            if (!colorObj && ID_MAPPING[pid]) {
                for (const oldId of ID_MAPPING[pid]) {
                    const oldKey = configState[oldId];
                    if (oldKey) {
                        colorObj = palette.find(c => c.key === oldKey) ||
                            palette.find(c => c.hex === oldKey) ||
                            palette.find(c => (c.key || "").split("_")[0] === (oldKey || "").split("_")[0]);
                        if (colorObj) break;
                    }
                }
            }

            let optionObj = options.find(o => o.key === optionKey);
            if (!optionObj && ID_MAPPING[pid]) {
                for (const oldId of ID_MAPPING[pid]) {
                    const oldKey = optionState[oldId];
                    if (oldKey) {
                        optionObj = options.find(o => o.key === oldKey);
                        if (optionObj) break;
                    }
                }
            }

            const isTrans = (pid !== "allButtons") && colorKey && (
                String(colorKey).toLowerCase().includes("_t") ||
                (colorObj && (colorObj.isTransparent || TRANSPARENT_HEXES.has((colorObj.hex || "").toLowerCase())))
            );

            snapshot.parts[pid] = {
                color: colorObj ? JSON.parse(JSON.stringify(colorObj)) : null,
                option: optionObj ? JSON.parse(JSON.stringify(optionObj)) : null,
                transparency: !!isTrans
            };
        });

        let sum = snapshot.basePrice;
        Object.keys(selectedPriceByPart).forEach(k => {
            const val = parseFloat(selectedPriceByPart[k]);
            if (!Number.isNaN(val)) sum += val;
        });
        Object.keys(selectedOptionPriceByPart).forEach(k => {
            const val = parseFloat(selectedOptionPriceByPart[k]);
            if (!Number.isNaN(val)) sum += val;
        });
        snapshot.total = sum;

        return snapshot;
    }

    async function buildPreviewImage(snapshot, side) {
        // Use a smaller dimension for previews to save localStorage space (Quota limit is ~5MB)
        const scale = 0.5;
        const width = Math.round(BASE_WIDTH * scale);
        const height = Math.round(BASE_HEIGHT * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        const loadImg = (src) => new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.warn("Failed to load preview asset:", src);
                resolve(null);
            };
            img.src = src;
        });

        const getPartTrans = (pid) => {
            const s = snapshot.parts && snapshot.parts[pid];
            return s ? !!s.transparency : false;
        };

        const transStatus = {
            shell: getPartTrans("shell"),
            trimpiece: getPartTrans("trimpiece"),
            touchpad: getPartTrans("touchpad")
        };

        const anyTransFront = (side === "front") && (transStatus.shell || transStatus.trimpiece || transStatus.touchpad);

        let ctrlSrc = "";
        const baseOverlays = [];
        if (side === "front") {
            if (anyTransFront) {
                ctrlSrc = "/assets/controller_t.png";
                if (!transStatus.shell) baseOverlays.push("/assets/controller_t_shell.png");
                if (!transStatus.trimpiece) baseOverlays.push("/assets/controller_t_trim.png");
                if (!transStatus.touchpad) baseOverlays.push("/assets/controller_t_touchpad.png");
            } else {
                ctrlSrc = "/assets/controller.png";
            }
        } else {
            const bsm = (snapshot.parts && snapshot.parts["backShellMain"]) || {};
            const isRampkit = bsm.option && bsm.option.key === "rampkit";
            if (isRampkit) ctrlSrc = "/assets/controller_back_ramp.png";
            else ctrlSrc = bsm.transparency ? "/assets/controller_back_t.png" : "/assets/controller_back.png";
        }

        // 1. Draw Background
        ctx.fillStyle = "#141829";
        ctx.fillRect(0, 0, width, height);

        // 2. Base Image
        const baseImg = await loadImg(ctrlSrc);
        if (baseImg) ctx.drawImage(baseImg, 0, 0, width, height);

        // 3. Mixed Transparency Overlays
        for (const ovSrc of baseOverlays) {
            const ovImg = await loadImg(ovSrc);
            if (ovImg) ctx.drawImage(ovImg, 0, 0, width, height);
        }

        // 4. Custom Parts
        const parts = side === "front" ? FRONT_PARTS : BACK_PARTS;
        for (const part of parts) {
            const state = snapshot.parts[part.id];
            if (!state || !state.color) continue;

            const isRampkit = side === "back" && part.id === "backShellMain" && state.option && state.option.key === "rampkit";
            if (isRampkit) continue;

            const hexRaw = (state.color && state.color.hex) || "";
            const hex = hexRaw.includes("_") ? hexRaw.split("_")[0] : hexRaw;
            const isTrans = state.transparency;

            let blendMode = "multiply";
            if (part.id === "allButtons") {
                // Face buttons should be opaque
                blendMode = isTrans ? "multiply" : "normal";
            } else if (part.id === "trimpiece" || part.id === "sticks" || part.id === "psButton") {
                blendMode = "soft-light";
            } else if (isTrans || side === "back") {
                blendMode = "multiply";
            }

            const partOpacity = isTrans ? TRANSPARENT_TINT_OPACITY : 1;
            const maskUrls = Array.isArray(part.mask) ? part.mask : [part.mask];

            for (const mUrl of maskUrls) {
                const mImg = await loadImg(mUrl);
                if (!mImg) continue;

                const tempCanvas = document.createElement("canvas");
                tempCanvas.width = width;
                tempCanvas.height = height;
                const tempCtx = tempCanvas.getContext("2d");

                tempCtx.drawImage(mImg, 0, 0, width, height);
                tempCtx.globalCompositeOperation = "source-in";

                if (part.id === "allButtons" && blendMode === "normal") {
                    // Create a radial gradient for 3D effect on buttons
                    const grad = tempCtx.createRadialGradient(
                        width * 0.35, height * 0.35, 0,
                        width * 0.5, height * 0.5, width * 0.4
                    );
                    grad.addColorStop(0, "rgba(255,255,255,0.2)");
                    grad.addColorStop(1, "transparent");

                    tempCtx.fillStyle = hex;
                    tempCtx.fillRect(0, 0, width, height);
                    tempCtx.fillStyle = grad;
                    tempCtx.fillRect(0, 0, width, height);
                } else {
                    tempCtx.fillStyle = hex;
                    tempCtx.fillRect(0, 0, width, height);
                }

                ctx.save();
                ctx.globalAlpha = partOpacity;
                ctx.globalCompositeOperation = blendMode;
                ctx.drawImage(tempCanvas, 0, 0);
                ctx.restore();
            }
        }

        return canvas.toDataURL("image/jpeg", 0.7);
    }

    if (addToCartBtn) {
        addToCartBtn.addEventListener("click", async () => {
            const snapshot = getSnapshot();
            const hasCustom = Object.values(snapshot.parts).some(p => p.color || (p.option && p.option.key !== "standard"));
            if (!hasCustom) {
                alert(t("alertNone"));
                return;
            }

            // Show loading state
            const origText = addToCartBtn.innerHTML;
            addToCartBtn.innerHTML = t("loadingPreview") || '<div class="zoho-loading-spinner" style="width:20px;height:20px;"></div>';
            addToCartBtn.disabled = true;

            try {
                const previewFront = await buildPreviewImage(snapshot, "front");
                const previewBack = await buildPreviewImage(snapshot, "back");

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
            } catch (err) {
                console.error("Cart Preview Generation Error:", err);
                // Fallback if canvas fails
                const cartItem = {
                    id: Date.now(),
                    total: snapshot.total,
                    parts: snapshot.parts
                };
                const cart = JSON.parse(localStorage.getItem("ezCart") || "[]");
                cart.push(cartItem);
                localStorage.setItem("ezCart", JSON.stringify(cart));
                window.location.href = "/cart";
            }
        });
    }

    bootstrapZohoInventory();
    applyLanguage();
    syncBaseImages();
    setPanel(currentPanel);

})();
