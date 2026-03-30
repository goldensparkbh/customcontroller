
(function () {
    const data = window.__CONFIG_DATA__ || {};
    const i18n = data.i18n || {};
    const ZOHO_ACCESS_TOKEN = data.zohoAccessToken || "";
    const ZOHO_ORG_ID = data.zohoOrgId || "";

    const isMobile =
        new RegExp("Mobi|Android|iPhone|iPad|iPod", "i").test(navigator.userAgent) ||
        window.innerWidth <= 900;

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

    function getAudioContext() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        if (!audioContext) {
            try {
                audioContext = new AudioCtx();
            } catch {
                audioContext = null;
            }
        }
        return audioContext;
    }

    function createNoiseBuffer(ctx, durationSeconds) {
        const frameCount = Math.max(1, Math.floor(ctx.sampleRate * durationSeconds));
        const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
        const channelData = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < frameCount; i += 1) {
            const white = Math.random() * 2 - 1;
            lastOut = (lastOut + (0.02 * white)) / 1.02;
            channelData[i] = lastOut * 0.75;
        }
        return buffer;
    }

    function startAmbientSound() {
        const ctx = getAudioContext();
        if (!ctx) return;

        try {
            if (ctx.state === "suspended") {
                ctx.resume().catch(() => { });
            }
        } catch { }

        if (ambientAudioStarted) return;

        const masterGain = ctx.createGain();
        masterGain.gain.value = 0.018;

        const lowpass = ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.value = 980;
        lowpass.Q.value = 0.3;

        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = createNoiseBuffer(ctx, 3.5);
        noiseSource.loop = true;

        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.028;

        const padA = ctx.createOscillator();
        padA.type = "sine";
        padA.frequency.value = 174;
        const padAGain = ctx.createGain();
        padAGain.gain.value = 0.0055;

        const padB = ctx.createOscillator();
        padB.type = "triangle";
        padB.frequency.value = 261.6;
        const padBGain = ctx.createGain();
        padBGain.gain.value = 0.0035;

        const shimmer = ctx.createOscillator();
        shimmer.type = "sine";
        shimmer.frequency.value = 523.25;
        const shimmerGain = ctx.createGain();
        shimmerGain.gain.value = 0.0008;

        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 0.07;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.006;

        const detuneLfo = ctx.createOscillator();
        detuneLfo.type = "sine";
        detuneLfo.frequency.value = 0.031;
        const detuneGain = ctx.createGain();
        detuneGain.gain.value = 6;

        noiseSource.connect(noiseGain);
        noiseGain.connect(lowpass);

        padA.connect(padAGain);
        padAGain.connect(lowpass);

        padB.connect(padBGain);
        padBGain.connect(lowpass);

        shimmer.connect(shimmerGain);
        shimmerGain.connect(lowpass);

        lfo.connect(lfoGain);
        lfoGain.connect(masterGain.gain);

        detuneLfo.connect(detuneGain);
        detuneGain.connect(padA.detune);
        detuneGain.connect(padB.detune);
        detuneGain.connect(shimmer.detune);

        lowpass.connect(masterGain);
        masterGain.connect(ctx.destination);

        noiseSource.start();
        padA.start();
        padB.start();
        shimmer.start();
        lfo.start();
        detuneLfo.start();

        ambientAudioNodes = [
            noiseSource, noiseGain,
            padA, padAGain,
            padB, padBGain,
            shimmer, shimmerGain,
            lfo, lfoGain,
            detuneLfo, detuneGain,
            lowpass, masterGain
        ];
        ambientAudioStarted = true;
    }

    function stopAmbientSound() {
        ambientAudioNodes.forEach(node => {
            if (!node) return;
            try {
                if (typeof node.stop === "function") node.stop();
            } catch { }
            try {
                if (typeof node.disconnect === "function") node.disconnect();
            } catch { }
        });
        ambientAudioNodes = [];
        ambientAudioStarted = false;

        if (audioContext) {
            try {
                audioContext.suspend().catch(() => { });
            } catch { }
        }
    }

    function bindAmbientAudio() {
        if (ambientUnlockBound) return;
        ambientUnlockBound = true;

        const unlockAmbient = () => {
            startAmbientSound();
        };
        ["pointerdown", "touchstart", "keydown"].forEach(eventName => {
            document.addEventListener(eventName, unlockAmbient, { passive: true });
            ambientCleanupFns.push(() => document.removeEventListener(eventName, unlockAmbient));
        });

        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopAmbientSound();
                return;
            }
            startAmbientSound();
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        ambientCleanupFns.push(() => document.removeEventListener("visibilitychange", handleVisibilityChange));

        startAmbientSound();
    }

    window.__EZ_CONFIGURATOR_CLEANUP__ = function () {
        stopAmbientSound();
        ambientCleanupFns.forEach(fn => {
            try {
                fn();
            } catch { }
        });
        ambientCleanupFns = [];
        ambientUnlockBound = false;
        delete window.__EZ_CONFIGURATOR_CLEANUP__;
    };

    const ZOHO_BASE = "/zoho/inventory/v1";
    const ZOHO_ITEMS_ENDPOINT = ZOHO_BASE + "/items";

    const dynamicColorsByPart = {};
    const dynamicOptionsByPart = {};
    const dynamicPricesByPart = {};
    const selectedPriceByPart = {};
    const selectedOptionPriceByPart = {};
    const zohoFetchError = { hasError: false, message: "" };

    // Persistent state
    const configData = window.__CONFIG_DATA__ || {};
    let baseControllerPrice = configData.baseControllerPrice || 0;
    const partsRowsById = {};
    let selectedPartId = null;
    let currentPanel = "options";
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
    const glossLayers = {};
    const maskDataById = {};
    let masksReady = false;
    const imageWarmupMeta = new Map();
    const imageWarmupQueue = [];
    const retainedWarmImages = new Map();
    const IMAGE_WARMUP_CONCURRENCY = isMobile ? 2 : 4;
    const RETAINED_WARM_IMAGE_LIMIT = isMobile ? 8 : 16;
    let imageWarmupInFlight = 0;
    let globalOverlayWarmupScheduled = false;
    let clearAnimationInFlight = false;
    let audioContext = null;
    let ambientAudioStarted = false;
    let ambientAudioNodes = [];
    let ambientUnlockBound = false;
    let ambientCleanupFns = [];

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

    const TECHNICAL_PARTS_LOOKUP = {
        shell: { mask: ["/assets/masks/leftShell.png", "/assets/masks/rightShell.png"], priority: 1, side: "front" },
        trimpiece: { mask: ["/assets/masks/centerBody.png"], priority: 4, side: "front" },
        sticks: { mask: ["/assets/masks/stickL.png", "/assets/masks/stickR.png"], priority: 3, side: "front" },
        allButtons: { mask: ["/assets/masks/faceButtons.png", "/assets/masks/share.png", "/assets/masks/options.png"], priority: 3, side: "front" },
        touchpad: { mask: ["/assets/masks/touchpad.png"], priority: 2, side: "front" },
        bumpersTriggers: { mask: ["/assets/masks/bumperL.png", "/assets/masks/bumperR.png", "/assets/masks/backTriggers.png"], priority: 2, side: "front" },
        psButton: { mask: ["/assets/masks/psButton.png"], priority: 5, side: "front" },
        backShellMain: { mask: ["/assets/masks/backShellMain.png"], priority: 2, side: "back" }
    };

    let FRONT_PARTS = [];
    let BACK_PARTS = [];
    let ALL_PARTS = [];
    let FRONT_PART_IDS = new Set();
    let BACK_PART_IDS = new Set();

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
                const isTransparent = (partId === "allButtons") ? false : (transparencyHint === true);

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

    function bootstrapConfigurator() {
        setZohoLoading(true);
        try {
            const firebaseParts = window.__CONFIG_FIREBASE_DATA__ || [];

            // Re-initialize ALL_PARTS from Firebase
            ALL_PARTS = firebaseParts.map(fbPart => {
                const tech = TECHNICAL_PARTS_LOOKUP[fbPart.id] || {};
                return {
                    id: fbPart.id,
                    title: fbPart.title,
                    icon: fbPart.icon || tech.icon, // Prefer FB icon
                    mask: tech.mask || [],
                    priority: fbPart.priority || tech.priority || 1,
                    side: fbPart.side || tech.side || 'front',
                    hiddenUI: fbPart.hiddenUI || false
                };
            });

            // Re-derive subset lists
            FRONT_PARTS = ALL_PARTS.filter(p => p.side === 'front');
            BACK_PARTS = ALL_PARTS.filter(p => p.side === 'back');
            FRONT_PART_IDS = new Set(FRONT_PARTS.map(p => p.id));
            BACK_PART_IDS = new Set(BACK_PARTS.map(p => p.id));

            // Re-build mask data
            rebuildMasks();
            // Re-build UI layers
            buildPartLayers();

            firebaseParts.forEach(fbPart => {
                const partId = fbPart.id;
                const options = fbPart.options || [];

                options.forEach(opt => {
                    const rawPrice = Number(opt.sellPrice != null ? opt.sellPrice : opt.price);
                    const rawQty = Number(opt.quantity);
                    const price = Number.isFinite(rawPrice) ? rawPrice : 0;
                    const qty = Number.isFinite(rawQty) ? rawQty : 0;

                    addPriceFallback(partId, price);

                    // Use accurate type field if available, fallback to substring matching
                    const isGamemode = opt.type === 'gamemode' || (opt.name.toLowerCase().includes("gamemode") || opt.name.toLowerCase().includes("performance") || fbPart.id === "sticks" || fbPart.id === "bumpersTriggers");
                    const nName = (opt.name || "").toLowerCase();
                    const isTransparent = (nName.includes("transparent") || nName.includes("trans"));

                    const entry = {
                        key: opt.id,
                        valName: opt.name, // Used for rendering labels directly
                        hex: opt.hex || opt.name, // Use actual Hex if provided, else fallback
                        price: price,
                        qty: qty,
                        isGamemode: isGamemode,
                        image: opt.image || null, // The overlay stack image!
                        secondImage: opt.secondImage || null,
                        icon: opt.icon || (isGamemode && opt.image ? opt.image : null), // Display in palette
                        isTransparent: isTransparent,
                        // Gamemode Dependency Fields
                        allowsMultiple: opt.allowsMultiple || false,
                        exclusiveGroup: opt.exclusiveGroup || null,
                        disablesColors: opt.disablesColors || false,
                        incompatibleWith: opt.incompatibleWith || [],
                        priority: opt.priority || 1
                    };

                    if (isGamemode) {
                        addVariantToMap(dynamicOptionsByPart, partId, entry);
                    } else {
                        addVariantToMap(dynamicColorsByPart, partId, entry);
                    }

                    // Ensure config/option state is initialized to null for this part
                    if (!(partId in configState)) configState[partId] = null;
                    if (!(partId in optionState)) optionState[partId] = []; // Always use array for options now to support gamemodes
                });
            });

            ensurePartStateDefaults();
            recomputeAvailableParts();
            restorePersistedSelections();
            buildPartsList();

            // Always select the first part on initial load as per user requirement.
            const initialPartId = getFirstShownPartId();
            if (initialPartId) {
                selectPart(initialPartId, { silent: true });
            } else {
                clearSelection();
                resetColorPanel();
                resetOptionsPanel();
            }

            // --- 5. Global Sync After Restoration ---
            // Ensure visual layers, prices, and summary are fully updated for ALL parts.
            updatePartsUI();
            updateSummary();
            saveConfigToStorage();

            scheduleGlobalOverlayWarmup(initialPartId);
        } catch (err) {
            console.error("[Firebase Config] Bootstrap failed:", err);
        } finally {
            setZohoLoading(false);
        }
    }

    function getEntryQty(entry) {
        if (!entry || typeof entry !== "object") return null;
        const candidates = [entry.qty, entry.quantity, entry.availableQty, entry.available_quantity];
        for (const candidate of candidates) {
            const qty = Number(candidate);
            if (Number.isFinite(qty)) return qty;
        }
        return null;
    }

    function isEntryOutOfStock(entry) {
        const qty = getEntryQty(entry);
        return qty !== null && qty <= 0;
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
    bindAmbientAudio();

    const mobileLangToggle = document.getElementById("mobileLangToggle");
    const navMenuBtn = document.querySelector(".nav-menu-btn");
    const mobileNavOverlay = document.getElementById("mobileNavOverlay");
    const mobileNavDrawer = document.getElementById("mobileNavDrawer");
    const configuratorControls = document.getElementById("configuratorControls");
    const panelButtons = configuratorControls ? configuratorControls.querySelectorAll("[data-panel]") : [];
    const panelSwitchButtons = document.querySelectorAll(".panel-switch-btn");
    const zohoLoadingOverlay = document.getElementById("zohoLoadingOverlay");

    function buildPartLayers() {
        // Clear existing layers if any
        if (faceFrontEl) {
            const existingFront = faceFrontEl.querySelectorAll(".part-layer-img, .part-gloss");
            existingFront.forEach(el => el.remove());
        }
        if (faceBackEl) {
            const existingBack = faceBackEl.querySelectorAll(".part-layer-img, .part-gloss");
            existingBack.forEach(el => el.remove());
        }
        // Reset layer objects
        Object.keys(layers).forEach(k => delete layers[k]);
        Object.keys(glossLayers).forEach(k => delete glossLayers[k]);

        ALL_PARTS.forEach(part => {
            // 1. Color/Tint layer as IMG
            const layerMain = document.createElement("img");
            layerMain.className = "part-layer-img";
            layerMain.dataset.partId = part.id;
            layerMain.style.display = "none";
            layerMain.style.zIndex = (part.priority || 1) * 10;

            const layerOpposite = document.createElement("img");
            layerOpposite.className = "part-layer-img";
            layerOpposite.dataset.partId = part.id + "_opp";
            layerOpposite.style.display = "none";
            layerOpposite.style.zIndex = (part.priority || 1) * 10;

            // 2. Gloss/Lighting layer (Legacy support)
            const gloss = document.createElement("div");
            gloss.className = "part-gloss";
            gloss.dataset.partId = part.id;

            if (part.side === "front") {
                if (faceFrontEl) {
                    faceFrontEl.appendChild(layerMain);
                    faceFrontEl.appendChild(gloss);
                }
                if (faceBackEl) {
                    faceBackEl.appendChild(layerOpposite);
                }
            } else {
                if (faceBackEl) {
                    faceBackEl.appendChild(layerMain);
                    faceBackEl.appendChild(gloss);
                }
                if (faceFrontEl) {
                    faceFrontEl.appendChild(layerOpposite);
                }
            }

            if (!layers[part.id]) layers[part.id] = [];
            layers[part.id].push({ main: layerMain, opp: layerOpposite });

            if (!glossLayers[part.id]) glossLayers[part.id] = [];
            glossLayers[part.id].push(gloss);
        });
    }
    // Don't call buildPartLayers() here anymore, it's called in bootstrapConfigurator

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

    async function rebuildMasks() {
        masksReady = false;
        for (const part of ALL_PARTS) {
            if (part.mask && part.mask.length > 0) {
                await loadMask(part);
            }
        }
        masksReady = true;
    }

    const mobileOptionsGrid = document.getElementById("mobileOptionsGrid");
    const mobileQuery = window.matchMedia("(max-width: 900px)");

    function ensurePartStateDefaults() {
        ALL_PARTS.forEach(p => {
            if (!(p.id in configState)) configState[p.id] = null;
            if (!(p.id in optionState)) optionState[p.id] = null;
            if (!(p.id in selectedTransparencyByPart)) selectedTransparencyByPart[p.id] = false;
            if (!(p.id in lastApplySeqByPart)) lastApplySeqByPart[p.id] = 0;
            if (!(p.id in selectedPriceByPart)) selectedPriceByPart[p.id] = 0;
            if (!(p.id in selectedOptionPriceByPart)) selectedOptionPriceByPart[p.id] = 0;
        });
    }

    function saveConfigToStorage() {
        const state = {
            configState,
            optionState,
            selectedPartId,
            currentPanel,
            currentSide
        };
        localStorage.setItem("ps5Config", JSON.stringify(state));
    }

    function getRenderedLayerImage(partId) {
        const partLayers = layers[partId] || [];
        for (const layerObj of partLayers) {
            const layer = layerObj.main;
            if (!layer || typeof layer.getAttribute !== "function") continue;
            if (layer.style && layer.style.display === "none") continue;
            const src = layer.getAttribute("src");
            if (src) return src;
        }
        return null;
    }

    function collectVisibleFaceLayers(side) {
        const faceEl = side === "front" ? faceFrontEl : faceBackEl;
        if (!faceEl) return [];
        return Array.from(faceEl.querySelectorAll("img"))
            .map((imgEl, idx) => {
                const computed = window.getComputedStyle(imgEl);
                const src = imgEl.currentSrc || imgEl.getAttribute("src") || "";
                const zIndex = Number.parseFloat(computed.zIndex);
                const opacity = Number.parseFloat(computed.opacity || "1");
                return {
                    idx,
                    src,
                    opacity: Number.isFinite(opacity) ? opacity : 1,
                    zIndex: Number.isFinite(zIndex) ? zIndex : 0,
                    visible: computed.display !== "none" && computed.visibility !== "hidden"
                };
            })
            .filter(item => item.visible && item.opacity > 0 && item.src)
            .sort((a, b) => {
                if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
                return a.idx - b.idx;
            })
            .map(({ src, opacity, zIndex }) => ({ src, opacity, zIndex }));
    }

    function loadConfigFromStorage() {
        try {
            const saved = localStorage.getItem("ps5Config");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.configState) Object.assign(configState, parsed.configState);
                if (parsed.optionState) Object.assign(optionState, parsed.optionState);
                if (Object.prototype.hasOwnProperty.call(parsed, "selectedPartId")) {
                    selectedPartId = parsed.selectedPartId || null;
                }
                if (parsed.currentPanel === "options" || parsed.currentPanel === "colors") {
                    currentPanel = parsed.currentPanel;
                }
                if (parsed.currentSide === "front" || parsed.currentSide === "back") {
                    currentSide = parsed.currentSide;
                }
            }
        } catch (e) {
            console.warn("Storage load failed", e);
        }
    }
    loadConfigFromStorage();

    function findColorSelection(partId, key) {
        if (!key) return null;
        const palette = getPaletteForPart(partId);
        const match = palette.find(c => c.key === key) ||
            palette.find(c => c.hex === key) ||
            palette.find(c => (c.key || "").split("_")[0] === (key || "").split("_")[0]) ||
            null;
        return isEntryOutOfStock(match) ? null : match;
    }

    function findOptionSelection(partId, key) {
        if (!key) return null;
        if (key === "standard") return null;
        const options = getOptionsForPart(partId);
        const match = options.find(o => o.key === key) || null;
        return isEntryOutOfStock(match) ? null : match;
    }

    function retainWarmImage(url, img) {
        if (!url || !img) return;
        if (retainedWarmImages.has(url)) retainedWarmImages.delete(url);
        retainedWarmImages.set(url, img);
        while (retainedWarmImages.size > RETAINED_WARM_IMAGE_LIMIT) {
            const oldestUrl = retainedWarmImages.keys().next().value;
            if (!oldestUrl) break;
            retainedWarmImages.delete(oldestUrl);
        }
    }

    function warmImageAsset(task) {
        return new Promise(resolve => {
            const img = new Image();
            img.decoding = "async";
            try {
                img.fetchPriority = task.priority === "high" ? "high" : "low";
            } catch { }

            const finalizeLoaded = () => {
                const meta = imageWarmupMeta.get(task.url) || {};
                meta.status = "loaded";
                imageWarmupMeta.set(task.url, meta);
                if (meta.retain) retainWarmImage(task.url, img);
                resolve();
            };

            img.onload = () => {
                const decodePromise = typeof img.decode === "function"
                    ? img.decode().catch(() => { })
                    : Promise.resolve();
                Promise.resolve(decodePromise).finally(finalizeLoaded);
            };
            img.onerror = () => {
                imageWarmupMeta.set(task.url, { status: "error", retain: false });
                resolve();
            };
            img.src = task.url;
        });
    }

    function flushImageWarmupQueue() {
        while (imageWarmupInFlight < IMAGE_WARMUP_CONCURRENCY && imageWarmupQueue.length > 0) {
            const task = imageWarmupQueue.shift();
            if (!task || !task.url) continue;
            const meta = imageWarmupMeta.get(task.url) || {};
            if (meta.status === "loaded" || meta.status === "loading") continue;
            meta.status = "loading";
            imageWarmupMeta.set(task.url, meta);
            imageWarmupInFlight += 1;
            warmImageAsset(task).finally(() => {
                imageWarmupInFlight = Math.max(0, imageWarmupInFlight - 1);
                if (imageWarmupQueue.length > 0) flushImageWarmupQueue();
            });
        }
    }

    function queueImageWarmup(url, opts = {}) {
        if (!url || typeof url !== "string") return;
        const cleanUrl = url.trim();
        if (!cleanUrl) return;

        const meta = imageWarmupMeta.get(cleanUrl) || { status: "idle", retain: false };
        if (opts.retain) meta.retain = true;

        if (meta.status === "loaded") {
            imageWarmupMeta.set(cleanUrl, meta);
            if (meta.retain && !retainedWarmImages.has(cleanUrl)) {
                meta.status = "queued";
            } else {
                if (retainedWarmImages.has(cleanUrl)) {
                    retainWarmImage(cleanUrl, retainedWarmImages.get(cleanUrl));
                }
                return;
            }
        }

        if (meta.status === "queued" || meta.status === "loading") {
            imageWarmupMeta.set(cleanUrl, meta);
            return;
        }

        meta.status = "queued";
        imageWarmupMeta.set(cleanUrl, meta);

        const task = {
            url: cleanUrl,
            priority: opts.priority === "high" ? "high" : "low"
        };
        if (task.priority === "high") imageWarmupQueue.unshift(task);
        else imageWarmupQueue.push(task);
        flushImageWarmupQueue();
    }

    function collectPartOverlayUrls(partId) {
        const urls = new Set();
        getPaletteForPart(partId).forEach(entry => {
            if (entry && entry.image) urls.add(entry.image);
            if (entry && entry.secondImage) urls.add(entry.secondImage);
        });
        getOptionsForPart(partId).forEach(entry => {
            if (entry && entry.image) urls.add(entry.image);
            if (entry && entry.secondImage) urls.add(entry.secondImage);
        });
        return Array.from(urls);
    }

    function warmPartOverlayImages(partId, opts = {}) {
        collectPartOverlayUrls(partId).forEach(url => {
            queueImageWarmup(url, opts);
        });
    }

    function warmSelectedOverlayImages() {
        ALL_PARTS.forEach(part => {
            const colorObj = findColorSelection(part.id, configState[part.id]);
            const optionObj = findOptionSelection(part.id, optionState[part.id]);
            if (colorObj && colorObj.image) {
                queueImageWarmup(colorObj.image, { priority: "high", retain: true });
            }
            if (colorObj && colorObj.secondImage) {
                queueImageWarmup(colorObj.secondImage, { priority: "high", retain: true });
            }
            if (optionObj && optionObj.image) {
                queueImageWarmup(optionObj.image, { priority: "high", retain: true });
            }
            if (optionObj && optionObj.secondImage) {
                queueImageWarmup(optionObj.secondImage, { priority: "high", retain: true });
            }
        });
    }

    function scheduleGlobalOverlayWarmup(initialPartId) {
        if (globalOverlayWarmupScheduled) return;
        globalOverlayWarmupScheduled = true;

        const runWarmup = () => {
            if (initialPartId) warmPartOverlayImages(initialPartId, { priority: "high", retain: true });

            const preferredIds = (currentSide === "back" ? BACK_PARTS : FRONT_PARTS).map(part => part.id);
            const deferredIds = (currentSide === "back" ? FRONT_PARTS : BACK_PARTS).map(part => part.id);

            preferredIds.concat(deferredIds).forEach(partId => {
                if (!partId || partId === initialPartId) return;
                warmPartOverlayImages(partId, { priority: "low", retain: false });
            });
        };

        if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(runWarmup, { timeout: 1200 });
        } else {
            window.setTimeout(runWarmup, 180);
        }
    }

    function syncPartVisualState(partId) {
        const palette = getPaletteForPart(partId);
        const options = getOptionsForPart(partId);

        // 1. Color Persistence/Mapping
        const colorKey = configState[partId];
        const colorObj = findColorSelection(partId, colorKey);
        if (colorKey && !colorObj) configState[partId] = null;
        selectedPriceByPart[partId] = (colorObj && colorObj.price != null) ? Number(colorObj.price) : 0;

        // 2. Option Persistence/Mapping (Handle Array)
        if (!Array.isArray(optionState[partId])) optionState[partId] = [];
        const currentOptions = optionState[partId];

        // Sum up prices for all valid selected options
        let totalOptPrice = 0;
        const activeEntries = [];

        // Add color if exists (base priority)
        if (colorObj) activeEntries.push({ ...colorObj, priority: 0 });

        currentOptions.forEach(k => {
            const opt = options.find(o => o.key === k);
            if (opt && !isEntryOutOfStock(opt)) {
                totalOptPrice += (opt.price || 0);
                activeEntries.push(opt);
            }
        });
        selectedOptionPriceByPart[partId] = totalOptPrice;

        // 3. Visual Layer Stacking (Priority-based)
        const targetLayers = layers[partId] || [];
        activeEntries.sort((a, b) => (a.priority || 0) - (b.priority || 0));

        const mainImg = [...activeEntries].reverse().find(e => e.image);
        const oppImg = [...activeEntries].reverse().find(e => e.secondImage);

        targetLayers.forEach(obj => {
            if (mainImg) {
                obj.main.src = mainImg.image;
                obj.main.style.display = "block";
            } else {
                obj.main.removeAttribute("src");
                obj.main.style.display = "none";
            }

            if (oppImg) {
                obj.opp.src = oppImg.secondImage;
                obj.opp.style.display = "block";
            } else {
                obj.opp.removeAttribute("src");
                obj.opp.style.display = "none";
            }
        });

        const targetGloss = glossLayers[partId] || [];
        targetGloss.forEach((gloss) => {
            gloss.style.opacity = "0";
            gloss.style.display = "none";
        });
    }

    function restorePersistedSelections() {
        ensurePartStateDefaults();
        ALL_PARTS.forEach((part) => syncPartVisualState(part.id));
        setSide(currentSide === "back" ? "back" : "front");
        syncBaseImages();
        updatePartsUI();
        updateVisualizerLayers();
        updateSummary();
        saveConfigToStorage();
    }

    function getFirstShownPartId() {
        const firstPrimary = primaryList ? primaryList.querySelector(".parts-item:not(.disabled)") : null;
        if (firstPrimary && firstPrimary.dataset.id) return firstPrimary.dataset.id;

        const firstSecondary = secondaryList ? secondaryList.querySelector(".parts-item:not(.disabled)") : null;
        if (firstSecondary && firstSecondary.dataset.id) return firstSecondary.dataset.id;

        const fallback = ALL_PARTS.find((part) => !part.hiddenUI && availablePartsSet.has(part.id));
        return fallback ? fallback.id : null;
    }

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
        currentPanel = panel;
        selectionPaletteMode = panel;

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

        if (accordionItems.length >= 2) {
            accordionItems.forEach((item) => item.classList.add("open"));
            refreshAccordionHeights();
        }

        if (selectedPartId) {
            openColorPanelForPart(selectedPartId);
        }

        saveConfigToStorage();
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
            // Key ending in _t is the most reliable hint set during parse
            if (key.toLowerCase().endsWith("_t")) return true;
            const palette = getPaletteForPart(pid);
            const col = palette.find(c => c.key === key);
            if (col && col.isTransparent) return true;
            return false;
        };

        const frontSrc = "/assets/controller.png";
        if (faceFrontImg.getAttribute("src") !== frontSrc) {
            faceFrontImg.src = frontSrc;
        }

        // Transparent selections are now image overlays, so the old transparent-base
        // controller variants and solid compensation overlays are no longer used.
        if (overlayShellImg) overlayShellImg.style.display = "none";
        if (overlayTrimImg) overlayTrimImg.style.display = "none";
        if (overlayTouchpadImg) overlayTouchpadImg.style.display = "none";

        // --- BACK SIDE LOGIC ---
        let backSrc = "/assets/controller_back.png";
        if (configState["backShellMain"] || optionState["backShellMain"]) {
            (layers["backShellMain"] || []).forEach(obj => {
                if (obj.main.getAttribute("src")) obj.main.style.display = "block";
                if (obj.opp.getAttribute("src")) obj.opp.style.display = "block";
            });
        }

        if (faceBackImg.getAttribute("src") !== backSrc) {
            faceBackImg.src = backSrc;
        }
    }

    function isMobileLayout() {
        return window.innerWidth <= 900;
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

    // Initial panel setup
    disableMobilePanels();
    setMobileActionBar(isMobileLayout());

    function applyTranslations() {
        const dict = i18n[currentLang];
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (dict[key] && !el.hasAttribute("data-no-translate")) {
                if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.placeholder = dict[key];
                else el.textContent = dict[key];
            }
        });
        document.querySelectorAll("[data-i18n-html]").forEach(el => {
            const key = el.getAttribute("data-i18n-html");
            if (dict[key] && !el.hasAttribute("data-no-translate")) el.innerHTML = dict[key];
        });
        document.querySelectorAll("[data-i18n-title]").forEach(el => {
            const key = el.getAttribute("data-i18n-title");
            if (dict[key]) el.title = dict[key];
        });
        document.querySelectorAll("[data-i18n-label]").forEach(el => {
            const key = el.getAttribute("data-i18n-label");
            if (dict[key]) el.setAttribute("aria-label", dict[key]);
        });
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
        updatePartsUI();
        updateVisualizerLayers();
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

        const secondaryIds = new Set(["shell", "trimpiece", "touchpad", "psButton", "allButtons"]);

        ALL_PARTS.forEach(part => {
            if (part.hiddenUI) return;
            const row = createPartRow(part);
            partsRowsById[part.id] = row;
            if (secondaryIds.has(part.id)) {
                if (secondaryList) secondaryList.appendChild(row);
            } else {
                if (primaryList) primaryList.appendChild(row);
            }
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
        row.title = part.title || ""; // Desktop tooltip
        if (!isPartActive(part)) row.classList.add("disabled");

        const thumb = document.createElement("div");
        thumb.className = "parts-thumb";
        const icon = document.createElement("img");
        icon.src = part.icon;
        icon.alt = part.title || ""; // Accessibility
        thumb.appendChild(icon);

        row.appendChild(thumb);
        // Only icon, no name or status

        row.addEventListener("click", () => {
            if (!isPartActive(part)) return;
            selectPart(part.id);
        });
        return row;
    }

    function selectPart(partId, opts = {}) {
        if (selectedPartId === partId) return;
        if (!opts.silent) playClick();
        selectedPartId = partId;
        warmPartOverlayImages(partId, { priority: "high", retain: true });
        // Prefer the non-hidden side for the UI selection
        const part = ALL_PARTS.find(p => p.id === partId && !p.hiddenUI) || ALL_PARTS.find(p => p.id === partId);
        if (part && part.side !== currentSide) {
            setSide(part.side);
        }
        updatePartsUI();
        updateVisualizerLayers();
        openColorPanelForPart(partId);
        saveConfigToStorage();
    }

    function _updateSidebarIcons() {
        // Use Live DOM Search for increased reliability instead of stale map references
        const allItems = document.querySelectorAll(".parts-item");

        allItems.forEach(row => {
            const id = row.dataset.id;
            const isActive = (id === selectedPartId);

            row.classList.toggle("active", isActive);

            const status = row.querySelector(".part-status");
            if (status) {
                const color = configState[id];
                const option = optionState[id];
                let statusText = "";
                // If it's an array (gamemodes), potentially show multiple or just primary
                const currentOptions = Array.isArray(option) ? option : (option ? [option] : []);

                if (currentOptions.length > 0) {
                    statusText = currentOptions.map(o => t("option_" + o)).join(", ");
                } else if (color) {
                    const colObj = (dynamicColorsByPart[id] || []).find(c => c.key === color);
                    if (colObj) {
                        if (colObj.hex && colObj.hex.startsWith("#")) statusText = colObj.hex;
                        else statusText = t("color_" + colObj.key);
                    }
                }
                status.textContent = statusText;
            }
        });
    }

    function updatePartsUI() {
        _updateSidebarIcons();
        updateVisualizerLayers();
    }

    function clearSelection() {
        selectedPartId = null;
        updatePartsUI();
        updateVisualizerLayers();
        resetColorPanel();
        resetOptionsPanel();
        Object.values(layers).forEach(layerArr => {
            if (Array.isArray(layerArr)) {
                layerArr.forEach(obj => {
                    obj.main.classList.remove("selected");
                    obj.opp.classList.remove("selected");
                });
            }
        });

        if (isMobileLayout()) updateMobileOptionsBar();
        saveConfigToStorage();
    }

    function resetColorPanel() {
        if (colorPanelHeaderBottom) colorPanelHeaderBottom.style.display = "none";
        if (colorPanelGrid) colorPanelGrid.style.display = "none";
        if (colorEmptyState) colorEmptyState.style.display = "flex";
    }
    function resetOptionsPanel() {
        if (optionsPanelGrid) optionsPanelGrid.innerHTML = "";
    }

    function openColorPanelForPart(partId) {
        const part = ALL_PARTS.find(p => p.id === partId);
        if (!part) return;

        const palette = getPaletteForPart(partId);
        const options = getOptionsForPart(partId);

        // Check if color customization is currently disabled by a selected gamemode
        const currentSelectedOptions = Array.isArray(optionState[partId]) ? optionState[partId] : [];
        const isColorDisabled = currentSelectedOptions.some(k => {
            const opt = options.find(o => o.key === k);
            return opt && opt.disablesColors;
        });

        const hasOptions = options.length > 0;
        const hasColors = !isColorDisabled && palette.length > 0;

        if (!hasOptions && !hasColors) {
            colorEmptyState.style.display = "flex";
            if (colorPanelHeaderTop) colorPanelHeaderTop.style.display = "none";
            if (colorPanelHeaderBottom) colorPanelHeaderBottom.style.display = "none";
            if (optionsPanelGrid) optionsPanelGrid.style.display = "none";
            if (colorPanelGrid) colorPanelGrid.style.display = "none";
            if (isMobileLayout()) updateMobileOptionsBar();
            return;
        }

        colorEmptyState.style.display = "none";
        const mobile = isMobileLayout();
        // Desktop (Universal): Show headers and grids only if they have content
        if (optionsPanelGrid) {
            optionsPanelGrid.style.display = hasOptions ? "grid" : "none";
            buildPaletteCells(optionsPanelGrid, options, true);
        }
        if (colorPanelGrid) {
            colorPanelGrid.style.display = hasColors ? "grid" : "none";
            buildPaletteCells(colorPanelGrid, hasColors ? palette : [], false);
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
            const solid = entries.filter(e => isAllButtons || !e.isTransparent);
            const trans = isAllButtons ? [] : entries.filter(e => e.isTransparent);

            const nullEntry = { key: null, isNullOption: true };

            if (solid.length > 0) {
                solid.unshift(nullEntry);
            } else if (trans.length > 0) {
                trans.unshift(nullEntry);
            }

            if (solid.length > 0) renderSection(target, solid, t("solidColors"), false);
            if (trans.length > 0) renderSection(target, trans, t("transparentColors"), false);
        }
    }

    function renderSection(target, entries, title, isOption) {
        const partId = selectedPartId;
        const currentOptions = Array.isArray(optionState[partId]) ? optionState[partId] : [];
        const partOptions = getOptionsForPart(partId);

        // Check if any selected option disables colors
        const colorDisabled = currentOptions.some(k => {
            const opt = partOptions.find(o => o.key === k);
            return opt && opt.disablesColors;
        });

        if (!isOption && colorDisabled) return; // Hide color section if disabled

        if (title) {
            const header = document.createElement("div");
            header.className = isMobileLayout() ? "mobile-group-title" : "color-group-title";
            header.textContent = title;
            target.appendChild(header);
        }

        entries.forEach(entry => {
            const cell = document.createElement("div");
            cell.className = isOption ? "cd-cell-op" : "cd-cell";
            if (isOption && entry.isGamemode) {
                cell.classList.add("is-gamemode-option");
            }
            const isOutOfStock = isEntryOutOfStock(entry);
            if (isOutOfStock) {
                cell.classList.add("is-disabled");
                cell.setAttribute("aria-disabled", "true");
                cell.title = t("outOfStock") || "Out of Stock";
            }
            let isSelected = false;
            let isIncompatible = false;
            const currentVal = isOption ? optionState[partId] : configState[partId];

            if (isOption) {
                const currentSelectedKeys = Array.isArray(currentVal) ? currentVal : [];
                isSelected = currentSelectedKeys.includes(entry.key);

                // Check incompatibility: 
                // If any currently selected item has this item in its incompatibleWith list, or reverse.
                if (!isSelected && entry.key !== "standard") {
                    isIncompatible = currentSelectedKeys.some(k => {
                        const other = entries.find(o => o.key === k);
                        if (other && other.incompatibleWith && other.incompatibleWith.includes(entry.key)) return true;
                        if (entry.incompatibleWith && entry.incompatibleWith.includes(k)) return true;
                        return false;
                    });
                }
            } else {
                if (entry.isNullOption) {
                    isSelected = (currentVal === null || currentVal === undefined);
                } else {
                    isSelected = (entry.key != null && currentVal === entry.key);
                }
            }

            if (isIncompatible) cell.classList.add("is-incompatible");
            else cell.classList.remove("is-incompatible");
            cell.classList.toggle("active", isSelected);

            const swatch = document.createElement("div");
            swatch.className = isOption ? "cd-swatch-op" : "cd-swatch";

            if (entry.isNullOption) {
                swatch.style.display = "flex";
                swatch.style.alignItems = "center";
                swatch.style.justifyContent = "center";
                swatch.style.fontSize = "1.5rem";
                swatch.textContent = "🚫";
                swatch.style.backgroundColor = "transparent";
                swatch.style.border = "1px dashed #30363d";
            } else {
                if (isOutOfStock) swatch.classList.add("is-out-of-stock");
                if (entry.icon) {
                    swatch.style.backgroundImage = `url('${entry.icon}')`;
                    swatch.style.backgroundSize = "cover";
                    swatch.style.backgroundColor = "transparent";
                } else {
                    swatch.style.backgroundColor = entry.hex;
                }
            }

            const shouldShowPriceInside = !isOutOfStock && entry.price != null && entry.price > 0 && entry.key !== "rampkit" && !entry.isGamemode;
            const shouldShowStockInside = isOutOfStock && !entry.isGamemode;
            if (shouldShowPriceInside || shouldShowStockInside) {
                const priceLabel = document.createElement("span");
                priceLabel.className = isOutOfStock ? "swatch-price is-out-of-stock" : "swatch-price";
                priceLabel.textContent = isOutOfStock ?
                    (t("outOfStock") || "Out of Stock") :
                    (i18n[currentLang].currencyPrefix + entry.price);
                swatch.appendChild(priceLabel);
            }

            cell.appendChild(swatch);

            if (entry.image) {
                const warmEntryImage = () => queueImageWarmup(entry.image, { priority: "high", retain: true });
                cell.addEventListener("mouseenter", warmEntryImage, { passive: true });
                cell.addEventListener("focusin", warmEntryImage);
                cell.addEventListener("touchstart", warmEntryImage, { passive: true, once: true });
                if (isSelected) warmEntryImage();
            }

            if (isOption) {
                const label = document.createElement("div");
                if (entry.isGamemode) {
                    label.className = "cd-color-name cd-gamemode-meta";

                    const title = document.createElement("div");
                    title.className = "cd-gamemode-title";
                    title.textContent = entry.valName || t("option_" + entry.key);
                    label.appendChild(title);

                    if (entry.price != null || isOutOfStock) {
                        const price = document.createElement("div");
                        price.className = isOutOfStock ? "cd-gamemode-price is-out-of-stock" : "cd-gamemode-price";
                        price.textContent = isOutOfStock ?
                            (t("outOfStock") || "Out of Stock") :
                            (i18n[currentLang].currencyPrefix + Number(entry.price).toFixed(2));
                        label.appendChild(price);
                    }
                } else {
                    label.className = "cd-color-name";
                    label.textContent = entry.valName || t("option_" + entry.key);
                }
                cell.appendChild(label);
            }

            cell.addEventListener("click", () => {
                if (isOutOfStock) return;
                if (isOption) applyOption(partId, entry.key);
                else applyColor(partId, entry.key);
            });
            target.appendChild(cell);
        });
    }

    function applyColor(partId, colorKey) {
        // Exclusive selection: clicking the same thing does nothing (no toggle off)
        if (configState[partId] === colorKey) {
            return;
        }

        const requestedColor = getPaletteForPart(partId).find(c =>
            c.key === colorKey ||
            c.hex === colorKey ||
            (c.key || "").split("_")[0] === (colorKey || "").split("_")[0]
        );
        if (colorKey !== null && isEntryOutOfStock(requestedColor)) return;

        playClick2();

        if (colorKey === null) {
            configState[partId] = null;
            selectedPriceByPart[partId] = 0;
        } else {
            configState[partId] = colorKey;
            setPartPrice(partId, colorKey, false);
        }

        saveConfigToStorage();

        const palette = getPaletteForPart(partId);
        const colObj = palette.find(c => c.key === configState[partId]);

        // If an option is active and has an image, DO NOT override its layer visually here
        const currentOptionKey = optionState[partId];
        const options = getOptionsForPart(partId);
        const activeOption = options.find(o => o.key === currentOptionKey);
        const optionHasOverrides = activeOption && activeOption.image;

        if (colObj && colObj.image) {
            queueImageWarmup(colObj.image, { priority: "high", retain: true });
        }

        if (!optionHasOverrides) {
            const targetLayers = layers[partId] || [];
            targetLayers.forEach(obj => {
                if (colObj) {
                    if (colObj.image) {
                        obj.main.src = colObj.image;
                        obj.main.style.display = "block";
                    } else {
                        obj.main.removeAttribute("src");
                        obj.main.style.display = "none";
                    }
                    if (colObj.secondImage) {
                        obj.opp.src = colObj.secondImage;
                        obj.opp.style.display = "block";
                    } else {
                        obj.opp.removeAttribute("src");
                        obj.opp.style.display = "none";
                    }
                } else {
                    obj.main.removeAttribute("src");
                    obj.main.style.display = "none";
                    obj.opp.removeAttribute("src");
                    obj.opp.style.display = "none";
                }
            });
        }

        // 2. Hide gloss layer entirely, as pre-rendered images have their own shading
        const targetGloss = glossLayers[partId] || [];
        targetGloss.forEach(gloss => {
            gloss.style.opacity = "0";
            gloss.style.display = "none";
        });

        updatePartsUI();
        syncBaseImages();
        updateSummary();
        if (selectedPartId === partId) openColorPanelForPart(partId);
    }

    function applyOption(partId, optionKey) {
        const options = getOptionsForPart(partId);
        const requestedOption = options.find(o => o.key === optionKey) || null;
        if (!requestedOption) return;

        // Standard handles resetting (clearing all)
        if (optionKey === "standard") {
            optionState[partId] = [];
            selectedOptionPriceByPart[partId] = 0;
            saveConfigToStorage();
            updatePartsUI();
            updateSummary();
            if (selectedPartId === partId) openColorPanelForPart(partId);
            return;
        }

        if (isEntryOutOfStock(requestedOption)) return;

        playClick2();

        if (!Array.isArray(optionState[partId])) optionState[partId] = [];
        let currentSelections = [...optionState[partId]];

        const isAlreadySelected = currentSelections.includes(optionKey);

        if (isAlreadySelected) {
            // Deselect if already selected (toggable)
            currentSelections = currentSelections.filter(k => k !== optionKey);
        } else {
            // 1. Handle Exclusive Groups (Deselect others in same group)
            // But only if the new option doesn't explicitly 'allowMultiple' within the group
            if (requestedOption.exclusiveGroup && !requestedOption.allowsMultiple) {
                currentSelections = currentSelections.filter(k => {
                    const opt = options.find(o => o.key === k);
                    return !opt || opt.exclusiveGroup !== requestedOption.exclusiveGroup;
                });
            }

            // 2. Handle Incompatibilities (Newest wins / Conflict resolution)
            const incompatibleList = Array.isArray(requestedOption.incompatibleWith) ? requestedOption.incompatibleWith : [];
            if (incompatibleList.length > 0) {
                currentSelections = currentSelections.filter(k => !incompatibleList.includes(k));
            }

            // Also check if any existing item is incompatible with this new one
            currentSelections = currentSelections.filter(k => {
                const opt = options.find(o => o.key === k);
                const list = (opt && Array.isArray(opt.incompatibleWith)) ? opt.incompatibleWith : [];
                return !opt || !list.includes(optionKey);
            });

            // 3. Handle Simple Radio Behavior (if NOT part of a group AND not allowing multiple)
            // This is for standard "choose one of many" behavior
            if (!requestedOption.allowsMultiple && !requestedOption.exclusiveGroup) {
                // Remove all other non-multiple, non-group items
                currentSelections = currentSelections.filter(k => {
                    const opt = options.find(o => o.key === k);
                    // Keep if it has its own group (isolation) or allows multiple
                    return opt && (opt.allowsMultiple || opt.exclusiveGroup);
                });
            }

            currentSelections.push(optionKey);
        }

        optionState[partId] = currentSelections;

        // --- 4. Handle Color-Disabling Cleanup & Price Reset ---
        const colorDisabled = currentSelections.some(k => {
            const opt = options.find(o => o.key === k);
            return opt && opt.disablesColors;
        });

        if (colorDisabled) {
            configState[partId] = null;
            selectedPriceByPart[partId] = 0;
        }

        // --- 5. Update Price (Sum of all active gamemodes) ---
        let totalPrice = 0;
        currentSelections.forEach(k => {
            const opt = options.find(o => o.key === k);
            if (opt) totalPrice += (opt.price || 0);
        });
        selectedOptionPriceByPart[partId] = totalPrice;

        saveConfigToStorage();

        // Warmup any new images
        currentSelections.forEach(k => {
            const opt = options.find(o => o.key === k);
            if (opt && opt.image) queueImageWarmup(opt.image, { priority: "high", retain: true });
        });

        updatePartsUI();
        syncBaseImages();
        updateSummary();
        if (selectedPartId === partId) openColorPanelForPart(partId);
    }
    function updateVisualizerLayers() {
        ALL_PARTS.forEach(part => {
            const partId = part.id;
            const targetLayers = layers[partId] || [];
            if (targetLayers.length === 0) return;

            const palette = getPaletteForPart(partId);
            const options = getOptionsForPart(partId);

            // 1. Collect all active entries for this part
            const activeEntries = [];

            // Color selection
            const colorKey = configState[partId];
            if (colorKey) {
                const col = palette.find(c => c.key === colorKey);
                if (col) activeEntries.push({ ...col, priority: 0 }); // Colors are usually base priority
            }

            // Options selection (Gamemodes)
            const currentOptions = Array.isArray(optionState[partId]) ? optionState[partId] : [];
            currentOptions.forEach(k => {
                const opt = options.find(o => o.key === k);
                if (opt) activeEntries.push(opt);
            });

            // 2. Sort by priority (Approved decision: By priority)
            activeEntries.sort((a, b) => (a.priority || 0) - (b.priority || 0));

            // 3. Update the layers
            // For now, we use the highest priority image that exists, 
            // but we can extend this to multiple sub-layers if buildPartLayers is updated.
            // Currently, we'll find the first one with a main image and the first with second image.
            const mainImg = [...activeEntries].reverse().find(e => e.image);
            const oppImg = [...activeEntries].reverse().find(e => e.secondImage);

            targetLayers.forEach(obj => {
                if (mainImg) {
                    obj.main.src = mainImg.image;
                    obj.main.style.display = "block";
                } else {
                    obj.main.removeAttribute("src");
                    obj.main.style.display = "none";
                }

                if (oppImg) {
                    obj.opp.src = oppImg.secondImage;
                    obj.opp.style.display = "block";
                } else {
                    obj.opp.removeAttribute("src");
                    obj.opp.style.display = "none";
                }
            });

            // Handle gloss visibility (if any option is selected, pre-rendered gloss is usually baked in)
            const hasOption = currentOptions.length > 0;
            const targetGloss = glossLayers[partId] || [];
            targetGloss.forEach(gloss => {
                gloss.style.opacity = hasOption ? "0" : "1";
                gloss.style.display = hasOption ? "none" : "block";
            });
        });
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
        saveConfigToStorage();
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

    function getActiveFaceElement() {
        return currentSide === "back" ? faceBackEl : faceFrontEl;
    }

    function getVisibleCustomizationLayersForCurrentSide() {
        const activeFace = getActiveFaceElement();
        if (!activeFace) return [];

        return Array.from(activeFace.querySelectorAll("img"))
            .filter((img, index) => {
                if (index === 0) return false;
                if (!img.getAttribute("src")) return false;
                const computed = window.getComputedStyle(img);
                return computed.display !== "none" && computed.visibility !== "hidden" && Number(computed.opacity || "1") > 0.01;
            });
    }

    function animateCurrentViewClear() {
        const visibleLayers = getVisibleCustomizationLayersForCurrentSide();

        if (!visibleLayers.length) return Promise.resolve();

        clearAnimationInFlight = true;

        return new Promise((resolve) => {
            let settled = false;
            let completed = 0;
            const finish = () => {
                if (settled) return;
                settled = true;
                clearAnimationInFlight = false;
                visibleLayers.forEach(layer => {
                    layer.classList.remove("config-layer-clearing");
                    layer.style.removeProperty("--clear-stagger");
                });
                resolve();
            };

            const fallbackTimer = window.setTimeout(finish, 900);

            visibleLayers.forEach((layer, index) => {
                layer.style.setProperty("--clear-stagger", `${index * 45}ms`);
                layer.classList.add("config-layer-clearing");
                layer.addEventListener("animationend", () => {
                    completed += 1;
                    if (completed >= visibleLayers.length) {
                        window.clearTimeout(fallbackTimer);
                        finish();
                    }
                }, { once: true });
            });
        });
    }

    async function clearAllSelections() {
        if (clearAnimationInFlight) return;
        await animateCurrentViewClear();
        ALL_PARTS.forEach(p => {
            configState[p.id] = null;
            optionState[p.id] = null;
            selectedPriceByPart[p.id] = 0;
            selectedOptionPriceByPart[p.id] = 0;
        });

        // Hide all layers
        Object.keys(layers).forEach(pid => {
            (layers[pid] || []).forEach(layerObj => {
                if (layerObj.main) layerObj.main.style.display = "none";
                if (layerObj.opp) layerObj.opp.style.display = "none";
            });
        });
        Object.keys(glossLayers).forEach(pid => {
            (glossLayers[pid] || []).forEach(glossObj => {
                if (glossObj.main) glossObj.main.style.opacity = "0";
                if (glossObj.opp) glossObj.opp.style.opacity = "0";
            });
        });

        saveConfigToStorage();
        syncBaseImages();
        updateSummary();
        updatePartsUI();
        updateVisualizerLayers();
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

            const isTrans = (pid !== "allButtons") && (colorObj && colorObj.isTransparent);

            snapshot.parts[pid] = {
                color: colorObj ? JSON.parse(JSON.stringify(colorObj)) : null,
                option: optionObj ? JSON.parse(JSON.stringify(optionObj)) : null,
                renderImage: getRenderedLayerImage(pid),
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
        // Render the exact visible controller stack from the configurator DOM.
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

        const stack = collectVisibleFaceLayers(side);

        // 1. Draw background
        ctx.fillStyle = "#141829";
        ctx.fillRect(0, 0, width, height);

        // 2. Draw exactly what is visible in the controller face stack.
        for (const layer of stack) {
            const img = await loadImg(layer.src);
            if (!img) continue;
            ctx.save();
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = layer.opacity;
            if (ctx.filter !== undefined) ctx.filter = "none";
            ctx.drawImage(img, 0, 0, width, height);
            ctx.restore();
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
                const previewFrontLayers = collectVisibleFaceLayers("front");
                const previewBackLayers = collectVisibleFaceLayers("back");
                const previewFront = await buildPreviewImage(snapshot, "front");
                const previewBack = await buildPreviewImage(snapshot, "back");

                const cartItem = {
                    id: Date.now(),
                    name: t("productName"),
                    total: snapshot.total,
                    parts: snapshot.parts,
                    previewFrontLayers: previewFrontLayers,
                    previewBackLayers: previewBackLayers,
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
                    name: t("productName"),
                    total: snapshot.total,
                    parts: snapshot.parts,
                    previewFrontLayers: collectVisibleFaceLayers("front"),
                    previewBackLayers: collectVisibleFaceLayers("back")
                };
                const cart = JSON.parse(localStorage.getItem("ezCart") || "[]");
                cart.push(cartItem);
                localStorage.setItem("ezCart", JSON.stringify(cart));
                window.location.href = "/cart";
            }
        });
    }


    /* ===================== MOBILE SCROLL BUTTONS ===================== */
    function initMobileScrollButtons() {
        const isMobile = window.innerWidth <= 900;
        if (!isMobile) return;

        const colorContainer = document.querySelector(".colors-column .color-panel");
        const scrollUpBtn = document.getElementById("mobileScrollUp");
        const scrollDownBtn = document.getElementById("mobileScrollDown");

        function updateColorButtons() {
            if (!colorContainer || !scrollUpBtn || !scrollDownBtn) return;
            const scrollTop = colorContainer.scrollTop;
            const maxScroll = colorContainer.scrollHeight - colorContainer.clientHeight;

            if (maxScroll <= 5) {
                scrollUpBtn.classList.remove("visible");
                scrollDownBtn.classList.remove("visible");
                return;
            }

            if (scrollTop > 10) {
                scrollUpBtn.classList.add("visible");
            } else {
                scrollUpBtn.classList.remove("visible");
            }

            if (scrollTop < maxScroll - 10) {
                scrollDownBtn.classList.add("visible");
            } else {
                scrollDownBtn.classList.remove("visible");
            }
        }

        if (colorContainer && scrollUpBtn && scrollDownBtn) {
            colorContainer.addEventListener("scroll", updateColorButtons, { passive: true });
            scrollUpBtn.addEventListener("click", () => {
                 const scrollAmount = colorContainer.clientHeight * 0.8;
                 colorContainer.scrollBy({ top: -scrollAmount, behavior: "smooth" });
            });
            scrollDownBtn.addEventListener("click", () => {
                 const scrollAmount = colorContainer.clientHeight * 0.8;
                 colorContainer.scrollBy({ top: scrollAmount, behavior: "smooth" });
            });
        }

        const partsContainer = document.querySelector(".parts-column .parts-panel");
        const scrollLeftBtn = document.getElementById("mobileScrollLeftBtn");
        const scrollRightBtn = document.getElementById("mobileScrollRightBtn");

        function updatePartsButtons() {
            if (!partsContainer || !scrollLeftBtn || !scrollRightBtn) return;
            const scrollLeftAbs = Math.abs(partsContainer.scrollLeft);
            const maxScroll = partsContainer.scrollWidth - partsContainer.clientWidth;

            if (maxScroll <= 5) {
                scrollLeftBtn.classList.remove("visible");
                scrollRightBtn.classList.remove("visible");
                return;
            }

            const isRtl = getComputedStyle(partsContainer).direction === 'rtl';
            const canScrollBack = scrollLeftAbs > 10;
            const canScrollForward = scrollLeftAbs < maxScroll - 10;

            if (isRtl) {
                 if (canScrollBack) scrollRightBtn.classList.add("visible");
                 else scrollRightBtn.classList.remove("visible");

                 if (canScrollForward) scrollLeftBtn.classList.add("visible");
                 else scrollLeftBtn.classList.remove("visible");
            } else {
                 if (canScrollBack) scrollLeftBtn.classList.add("visible");
                 else scrollLeftBtn.classList.remove("visible");

                 if (canScrollForward) scrollRightBtn.classList.add("visible");
                 else scrollRightBtn.classList.remove("visible");
            }
        }

        if (partsContainer && scrollLeftBtn && scrollRightBtn) {
            partsContainer.addEventListener("scroll", updatePartsButtons, { passive: true });
            
            scrollLeftBtn.addEventListener("click", () => {
                 const scrollAmount = partsContainer.clientWidth * 0.8;
                 const dirMultiplier = getComputedStyle(partsContainer).direction === 'rtl' ? 1 : -1;
                 partsContainer.scrollBy({ left: dirMultiplier * scrollAmount, behavior: "smooth" });
            });
            scrollRightBtn.addEventListener("click", () => {
                 const scrollAmount = partsContainer.clientWidth * 0.8;
                 const dirMultiplier = getComputedStyle(partsContainer).direction === 'rtl' ? -1 : 1;
                 partsContainer.scrollBy({ left: dirMultiplier * scrollAmount, behavior: "smooth" });
            });
        }

        function updateAllButtons() {
            updateColorButtons();
            updatePartsButtons();
        }

        window.addEventListener("resize", updateAllButtons, { passive: true });

        // Initial check
        setTimeout(updateAllButtons, 300);
        setTimeout(updateAllButtons, 1200);
    }
    /* ============================================================= */

    bootstrapConfigurator();
    initMobileScrollButtons();
    applyLanguage();
    syncBaseImages();
    setPanel(currentPanel);

})();
