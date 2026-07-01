
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
    let baseControllerQty = configData.baseControllerQty;
    let baseControllerLowStockThreshold = Number(configData.baseControllerLowStockThreshold);
    if (!Number.isFinite(baseControllerLowStockThreshold) || baseControllerLowStockThreshold < 0) {
        baseControllerLowStockThreshold = 5;
    }
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
    const premadeFaceOverlays = {};
    const maskDataById = {};
    let masksReady = false;
    const imageWarmupMeta = new Map();
    const imageWarmupQueue = [];
    const retainedWarmImages = new Map();
    const IMAGE_WARMUP_CONCURRENCY = isMobile ? 3 : 8;
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

    function formatEzMoney(bhdAmount) {
        const n = Number(bhdAmount);
        const safe = Number.isFinite(n) ? n : 0;
        if (window.__EZ_CURRENCY__ && typeof window.__EZ_CURRENCY__.format === "function") {
            return window.__EZ_CURRENCY__.format(safe);
        }
        const lc = i18n[currentLang] || i18n.ar || i18n.en || {};
        return (lc.currencyPrefix || "BHD ") + safe.toFixed(2);
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

    function collectAllConfiguratorImageUrls() {
        const urls = new Set();
        ALL_PARTS.forEach((part) => {
            if (!part) return;
            if (part.icon) urls.add(part.icon);
            const masks = part.mask;
            if (Array.isArray(masks)) {
                masks.forEach((m) => {
                    if (m) urls.add(m);
                });
            } else if (typeof masks === "string" && masks) {
                urls.add(masks);
            }
            (getPaletteForPart(part.id) || []).forEach((e) => {
                if (!e) return;
                if (e.image) urls.add(e.image);
                if (e.secondImage) urls.add(e.secondImage);
                if (e.icon) urls.add(e.icon);
            });
            (getOptionsForPart(part.id) || []).forEach((e) => {
                if (!e) return;
                if (e.image) urls.add(e.image);
                if (e.secondImage) urls.add(e.secondImage);
                if (e.icon) urls.add(e.icon);
            });
        });
        return Array.from(urls).filter((u) => typeof u === "string" && u.trim());
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
                    hiddenUI: fbPart.hiddenUI || false,
                    componentType: fbPart.componentType === 'premade' ? 'premade' : 'regular'
                };
            });

            // Re-derive subset lists
            FRONT_PARTS = ALL_PARTS.filter(p => p.side === 'front');
            BACK_PARTS = ALL_PARTS.filter(p => p.side === 'back');
            FRONT_PART_IDS = new Set(FRONT_PARTS.map(p => p.id));
            BACK_PART_IDS = new Set(BACK_PARTS.map(p => p.id));

            // Mask + tint data (async); UI stays usable while masks finish loading
            void rebuildMasks();
            // Re-build UI layers
            buildPartLayers();
            buildPremadeFaceOverlays();

            firebaseParts.forEach(fbPart => {
                const partId = fbPart.id;
                const componentType = fbPart.componentType === 'premade' ? 'premade' : 'regular';
                const options = fbPart.options || [];

                options.forEach(opt => {
                    const rawPrice = Number(opt.sellPrice != null ? opt.sellPrice : opt.price);
                    const rawQty = Number(opt.quantity);
                    const price = Number.isFinite(rawPrice) ? rawPrice : 0;
                    const qty = Number.isFinite(rawQty) ? rawQty : 0;

                    addPriceFallback(partId, price);

                    const isPremade = opt.type === 'premade';
                    if (componentType === 'regular' && isPremade) return;
                    if (componentType === 'premade' && !isPremade) return;

                    const isGamemode = !isPremade && (opt.type === 'gamemode' || (opt.name.toLowerCase().includes("gamemode") || opt.name.toLowerCase().includes("performance") || fbPart.id === "sticks" || fbPart.id === "bumpersTriggers"));
                    const nName = (opt.name || "").toLowerCase();
                    const isTransparent = (nName.includes("transparent") || nName.includes("trans"));

                    const entry = {
                        key: opt.id,
                        valName: opt.name, // Used for rendering labels directly
                        hex: opt.hex || opt.name, // Use actual Hex if provided, else fallback
                        price: price,
                        qty: qty,
                        type: isPremade ? 'premade' : (isGamemode ? 'gamemode' : 'color'),
                        isGamemode: isGamemode,
                        isPremade: isPremade,
                        image: opt.image || null, // The overlay stack image!
                        secondImage: opt.secondImage || null,
                        icon: opt.icon || ((isGamemode || isPremade) && opt.image ? opt.image : null), // Display in palette
                        isTransparent: isTransparent,
                        affectedParts: Array.isArray(opt.affectedParts) && opt.affectedParts.length ? opt.affectedParts : [partId],
                        // Gamemode Dependency Fields
                        allowsMultiple: opt.allowsMultiple || false,
                        exclusiveGroup: opt.exclusiveGroup || null,
                        disablesColors: opt.disablesColors || false,
                        incompatibleWith: opt.incompatibleWith || [],
                        priority: isPremade ? (opt.priority ?? -10) : (opt.priority || 1)
                    };

                    if (isGamemode || isPremade) {
                        addVariantToMap(dynamicOptionsByPart, partId, entry);
                    } else {
                        addVariantToMap(dynamicColorsByPart, partId, entry);
                    }

                    // Ensure config/option state is initialized to null for this part
                    if (!(partId in optionState)) optionState[partId] = [];
                });
            });

            ensurePartStateDefaults();
            recomputeAvailableParts();
            restorePersistedSelections();
            buildPartsList();

            // Default to front shell on initial load when available.
            const initialPartId = getDefaultInitialPartId();
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
            scheduleCatalogImagePreloadInBackground();
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
    const flipControlBtn = document.getElementById("flipControlBtn");
    const summaryAmountEl = document.getElementById("summaryAmount");
    const addToCartBtn = document.getElementById("addToCartBtn");
    const addToCartHome = addToCartBtn ? { parent: addToCartBtn.parentElement, next: addToCartBtn.nextSibling } : null;

    const colorPanelSub = document.getElementById("colorPanelSub");
    const colorPanelGrid = document.getElementById("colorPanelGrid");
    const optionsPanelGrid = document.getElementById("optionsPanelGrid");
    const colorPanelHeaderBottom = document.getElementById("colorPanelHeaderBottom");
    const colorEmptyState = document.getElementById("colorEmptyState");

    const partsList = document.getElementById("partsList") || document.querySelector(".parts-list");
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

    function isPremadeComponentPart(partId) {
        const part = ALL_PARTS.find(p => p.id === partId);
        return !!(part && part.componentType === 'premade');
    }

    function getStackZIndex(part, stackIndex) {
        const partPri = part.priority || 1;
        if (stackIndex === 0) {
            return String(partPri);
        }
        if (stackIndex === 1) {
            return String(100 + partPri * 10);
        }
        return String(100 + partPri * 10 + 5);
    }

    function createStackImages(part, stackIndex) {
        const zIndex = getStackZIndex(part, stackIndex);
        const main = document.createElement("img");
        main.className = "part-layer-img";
        main.dataset.partId = part.id;
        main.dataset.stack = String(stackIndex);
        main.style.display = "none";
        main.style.zIndex = zIndex;

        const opp = document.createElement("img");
        opp.className = "part-layer-img";
        opp.dataset.partId = part.id + "_opp";
        opp.dataset.stack = String(stackIndex);
        opp.style.display = "none";
        opp.style.zIndex = zIndex;

        return { main, opp };
    }

    function setStackImage(stack, mainUrl, oppUrl) {
        if (!stack) return;
        if (mainUrl) {
            stack.main.src = mainUrl;
            stack.main.style.display = "block";
        } else {
            stack.main.removeAttribute("src");
            stack.main.style.display = "none";
        }
        if (oppUrl) {
            stack.opp.src = oppUrl;
            stack.opp.style.display = "block";
        } else {
            stack.opp.removeAttribute("src");
            stack.opp.style.display = "none";
        }
    }

    function getPremadeEntriesForPart(partId) {
        const entries = [];
        ALL_PARTS.forEach(p => {
            if (p.componentType !== 'premade') return;
            const options = getOptionsForPart(p.id);
            const currentOptions = Array.isArray(optionState[p.id]) ? optionState[p.id] : [];
            currentOptions.forEach(k => {
                const opt = options.find(o => o.key === k);
                if (!opt || opt.type !== "premade" || isEntryOutOfStock(opt)) return;
                const affected = Array.isArray(opt.affectedParts) && opt.affectedParts.length ? opt.affectedParts : [p.id];
                if (affected.includes(partId)) entries.push(opt);
            });
        });
        return entries;
    }

    /** Clear color/option picks on regular parts covered by a pre-made design (one-way only). */
    function clearRegularPartsCoveredByPremade(premadeOption) {
        if (!premadeOption || premadeOption.type !== "premade") return;
        const affected = Array.isArray(premadeOption.affectedParts) && premadeOption.affectedParts.length
            ? premadeOption.affectedParts
            : [];
        if (!affected.length) return;

        affected.forEach(affectedPartId => {
            const targetPart = ALL_PARTS.find(p => p.id === affectedPartId);
            if (!targetPart || targetPart.componentType === "premade") return;

            configState[affectedPartId] = null;
            optionState[affectedPartId] = [];
            selectedPriceByPart[affectedPartId] = 0;
            selectedOptionPriceByPart[affectedPartId] = 0;
        });
    }

    /** Re-apply coverage clears for all active pre-made selections (e.g. after restore). */
    function enforcePremadeCoverageClears() {
        ALL_PARTS.forEach(p => {
            if (p.componentType !== "premade") return;
            const options = getOptionsForPart(p.id);
            const currentOptions = Array.isArray(optionState[p.id]) ? optionState[p.id] : [];
            currentOptions.forEach(k => {
                const opt = options.find(o => o.key === k);
                if (opt && opt.type === "premade" && !isEntryOutOfStock(opt)) {
                    clearRegularPartsCoveredByPremade(opt);
                }
            });
        });
    }

    function partHasActiveCustomization(partId) {
        if (configState[partId]) return true;
        const currentOptions = Array.isArray(optionState[partId]) ? optionState[partId] : [];
        if (!currentOptions.length) return false;
        const options = getOptionsForPart(partId);
        return currentOptions.some(k => {
            const opt = options.find(o => o.key === k);
            return opt && !isEntryOutOfStock(opt);
        });
    }

    function getPartMaskUrls(part) {
        if (!part || !part.mask) return [];
        const masks = Array.isArray(part.mask) ? part.mask : [part.mask];
        return masks.map((m) => String(m || "").trim()).filter(Boolean);
    }

    function getPartMaskUrl(part) {
        const urls = getPartMaskUrls(part);
        return urls.length ? urls[0] : null;
    }

    function applyPartMaskToImg(imgEl, part) {
        if (!imgEl || !part) return;
        const maskPaths = getPartMaskUrls(part);
        if (!maskPaths.length) return;

        const maskUrls = maskPaths.map((path) => `url('${path}')`).join(", ");

        imgEl.style.webkitMaskImage = maskUrls;
        imgEl.style.maskImage = maskUrls;
        imgEl.style.webkitMaskSize = maskPaths.map(() => "contain").join(", ");
        imgEl.style.maskSize = maskPaths.map(() => "contain").join(", ");
        imgEl.style.webkitMaskPosition = maskPaths.map(() => "center").join(", ");
        imgEl.style.maskPosition = maskPaths.map(() => "center").join(", ");
        imgEl.style.webkitMaskRepeat = maskPaths.map(() => "no-repeat").join(", ");
        imgEl.style.maskRepeat = maskPaths.map(() => "no-repeat").join(", ");
        imgEl.style.webkitMaskOrigin = "border-box";
        imgEl.style.maskOrigin = "border-box";
        imgEl.style.webkitMaskClip = "border-box";
        imgEl.style.maskClip = "border-box";

        if (maskPaths.length > 1) {
            imgEl.style.webkitMaskComposite = "source-over";
            imgEl.style.maskComposite = "add";
        } else {
            imgEl.style.removeProperty("-webkit-mask-composite");
            imgEl.style.removeProperty("mask-composite");
        }
    }

    function clearPartMaskFromImg(imgEl) {
        if (!imgEl) return;
        imgEl.style.removeProperty("-webkit-mask-image");
        imgEl.style.removeProperty("mask-image");
        imgEl.style.removeProperty("-webkit-mask-size");
        imgEl.style.removeProperty("mask-size");
        imgEl.style.removeProperty("-webkit-mask-position");
        imgEl.style.removeProperty("mask-position");
        imgEl.style.removeProperty("-webkit-mask-repeat");
        imgEl.style.removeProperty("mask-repeat");
        imgEl.style.removeProperty("-webkit-mask-origin");
        imgEl.style.removeProperty("mask-origin");
        imgEl.style.removeProperty("-webkit-mask-clip");
        imgEl.style.removeProperty("mask-clip");
    }

    /** Which controller face (front/back) a stack slot is rendered on in the DOM. */
    function getPhysicalFaceForLayer(part, isOppElement) {
        if (!part) return currentSide;
        const isFrontPart = part.side === "front";
        if (isOppElement) {
            return isFrontPart ? "back" : "front";
        }
        return isFrontPart ? "front" : "back";
    }

    function shouldShowPremadeLayer(part, isOppElement) {
        if (!part) return false;
        const isFrontPart = part.side === "front";
        if (currentSide === "front") {
            return isFrontPart && !isOppElement;
        }
        if (isFrontPart) return isOppElement;
        return !isOppElement;
    }

    function shouldShowLayerOnCurrentSide(part, isOppElement, isPremade) {
        if (isPremade) return shouldShowPremadeLayer(part, isOppElement);
        return getPhysicalFaceForLayer(part, isOppElement) === currentSide;
    }

    function syncStackLayerVisibility(stack, part, isPremade) {
        if (!stack || !part) return;
        [
            { el: stack.main, isOpp: false },
            { el: stack.opp, isOpp: true }
        ].forEach(({ el, isOpp }) => {
            if (!el) return;
            const active = el.getAttribute("src") && el.style.display !== "none";
            if (!active) {
                el.style.visibility = "";
                el.style.pointerEvents = "";
                if (isPremade) clearPartMaskFromImg(el);
                return;
            }
            const show = shouldShowLayerOnCurrentSide(part, isOpp, isPremade);
            el.style.visibility = show ? "visible" : "hidden";
            el.style.pointerEvents = show ? "" : "none";
            if (isPremade) {
                if (show) applyPartMaskToImg(el, part);
                else clearPartMaskFromImg(el);
            }
        });
    }

    function updateFlipControl() {
        const label = currentSide === "front" ? (t("front") || "Front") : (t("back") || "Back");
        if (flipControlBtn) {
            flipControlBtn.setAttribute("aria-label", label);
            flipControlBtn.classList.toggle("is-back", currentSide === "back");
        }
        if (controllerFlipBtn) {
            controllerFlipBtn.setAttribute("aria-label", label);
            controllerFlipBtn.classList.toggle("flipped", currentSide === "back");
        }
        document.querySelectorAll(".flip-toggle").forEach((btn) => {
            btn.classList.toggle("flipped", currentSide === "back");
        });
    }

    function getGamemodeEntriesForPart(partId) {
        const options = getOptionsForPart(partId);
        const currentOptions = Array.isArray(optionState[partId]) ? optionState[partId] : [];
        return currentOptions
            .map(k => options.find(o => o.key === k))
            .filter(o => o && o.type !== "premade" && !isEntryOutOfStock(o));
    }

    function getLayerStacks(partId) {
        const stack = layers[partId];
        if (!stack) return [];
        return [stack.premade, stack.color, stack.option].filter(Boolean);
    }

    function getActivePremadeSelectionForComponent(componentPartId) {
        const options = getOptionsForPart(componentPartId);
        const currentOptions = Array.isArray(optionState[componentPartId]) ? optionState[componentPartId] : [];
        const selected = currentOptions
            .map((k) => options.find((o) => o.key === k))
            .filter((o) => o && o.type === "premade" && !isEntryOutOfStock(o));
        if (!selected.length) return null;
        selected.sort((a, b) => (a.priority || -10) - (b.priority || -10));
        return selected[selected.length - 1];
    }

    function isPartCoveredByActivePremadeFace(partId) {
        return ALL_PARTS.some((p) => {
            if (p.componentType !== "premade") return false;
            const active = getActivePremadeSelectionForComponent(p.id);
            if (!active) return false;
            const affected = Array.isArray(active.affectedParts) && active.affectedParts.length
                ? active.affectedParts
                : [];
            return affected.includes(partId);
        });
    }

    function buildPremadeFaceOverlays() {
        document.querySelectorAll(".premade-face-overlay").forEach((el) => el.remove());
        Object.keys(premadeFaceOverlays).forEach((k) => delete premadeFaceOverlays[k]);

        ALL_PARTS.filter((p) => p.componentType === "premade").forEach((part) => {
            const frontImg = document.createElement("img");
            frontImg.className = "part-layer-img premade-face-overlay";
            frontImg.dataset.premadeComponentId = part.id;
            frontImg.alt = "";
            frontImg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center center;pointer-events:none;z-index:12;display:none;";

            const backImg = document.createElement("img");
            backImg.className = "part-layer-img premade-face-overlay";
            backImg.dataset.premadeComponentId = part.id;
            backImg.alt = "";
            backImg.style.cssText = frontImg.style.cssText;

            if (faceFrontEl) faceFrontEl.appendChild(frontImg);
            if (faceBackEl) faceBackEl.appendChild(backImg);
            premadeFaceOverlays[part.id] = { front: frontImg, back: backImg };
        });
    }

    function updatePremadeFaceOverlays() {
        ALL_PARTS.filter((p) => p.componentType === "premade").forEach((part) => {
            const faceLayers = premadeFaceOverlays[part.id];
            if (!faceLayers) return;

            const active = getActivePremadeSelectionForComponent(part.id);
            const { front, back } = faceLayers;

            if (!active) {
                front.style.display = "none";
                back.style.display = "none";
                front.removeAttribute("src");
                back.removeAttribute("src");
                return;
            }

            if (active.image) {
                if (front.getAttribute("src") !== active.image) front.src = active.image;
                front.style.display = "block";
            } else {
                front.style.display = "none";
                front.removeAttribute("src");
            }

            if (active.secondImage) {
                if (back.getAttribute("src") !== active.secondImage) back.src = active.secondImage;
                back.style.display = "block";
            } else {
                back.style.display = "none";
                back.removeAttribute("src");
            }
        });
    }

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
            const premade = createStackImages(part, 0);
            const color = createStackImages(part, 1);
            const option = createStackImages(part, 2);

            const gloss = document.createElement("div");
            gloss.className = "part-gloss";
            gloss.dataset.partId = part.id;

            const appendFront = (el) => { if (faceFrontEl) faceFrontEl.appendChild(el); };
            const appendBack = (el) => { if (faceBackEl) faceBackEl.appendChild(el); };

            if (part.side === "front") {
                appendFront(premade.main);
                appendFront(color.main);
                appendFront(option.main);
                appendFront(gloss);
                appendBack(premade.opp);
                appendBack(color.opp);
                appendBack(option.opp);
            } else {
                appendBack(premade.main);
                appendBack(color.main);
                appendBack(option.main);
                appendBack(gloss);
                appendFront(premade.opp);
                appendFront(color.opp);
                appendFront(option.opp);
            }

            layers[part.id] = { premade, color, option };

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
            if (!(p.id in optionState)) optionState[p.id] = [];
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
        const stacks = getLayerStacks(partId);
        for (let i = stacks.length - 1; i >= 0; i -= 1) {
            const layer = stacks[i].main;
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

        const domLayers = Array.from(faceEl.querySelectorAll("img"))
            .map((imgEl, idx) => {
                const computed = window.getComputedStyle(imgEl);
                const src = imgEl.currentSrc || imgEl.getAttribute("src") || "";
                if (!src || computed.display === "none") return null;
                const zIndex = Number.parseFloat(computed.zIndex);
                const opacity = Number.parseFloat(computed.opacity || "1");
                if (!Number.isFinite(opacity) || opacity <= 0) return null;
                return {
                    idx,
                    src,
                    opacity,
                    zIndex: Number.isFinite(zIndex) ? zIndex : 0
                };
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
                return a.idx - b.idx;
            })
            .map(({ src, opacity, zIndex }) => ({ src, opacity, zIndex }));

        const overlayLayers = [];
        ALL_PARTS.filter((p) => p.componentType === "premade").forEach((part) => {
            const active = getActivePremadeSelectionForComponent(part.id);
            if (!active) return;
            const src = side === "back" ? active.secondImage : active.image;
            if (!src || domLayers.some((layer) => layer.src === src)) return;
            overlayLayers.push({ src, opacity: 1, zIndex: 12 });
        });

        return [...domLayers, ...overlayLayers].sort((a, b) => a.zIndex - b.zIndex);
    }

    function loadConfigFromStorage() {
        try {
            const saved = localStorage.getItem("ps5Config");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.configState) Object.assign(configState, parsed.configState);
                if (parsed.optionState) {
                    Object.keys(parsed.optionState).forEach(pid => {
                        const val = parsed.optionState[pid];
                        optionState[pid] = Array.isArray(val) ? val : (val ? [val] : []);
                    });
                }
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

    function scheduleCatalogImagePreloadInBackground() {
        try {
            const urls = collectAllConfiguratorImageUrls();
            if (!urls.length) return;
            const enqueue = () => {
                urls.forEach((url) => queueImageWarmup(url, { priority: "low", retain: false }));
            };
            if (typeof window.requestIdleCallback === "function") {
                window.requestIdleCallback(enqueue, { timeout: 2500 });
            } else {
                window.setTimeout(enqueue, 0);
            }
        } catch (_e) {
            /* ignore */
        }
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
        currentOptions.forEach(k => {
            const opt = options.find(o => o.key === k);
            if (opt && !isEntryOutOfStock(opt)) {
                totalOptPrice += (opt.price || 0);
            }
        });
        selectedOptionPriceByPart[partId] = totalOptPrice;

        // 3. Visual Layer Stacking (premade -> color -> option)
        updatePartVisualStacks(partId);
    }

    function updatePartVisualStacks(partId) {
        const stack = layers[partId];
        if (!stack) return;

        const part = ALL_PARTS.find(p => p.id === partId);
        const palette = getPaletteForPart(partId);

        let premadeMain = null;
        let premadeOpp = null;
        const useFullFacePremade = isPartCoveredByActivePremadeFace(partId);
        if (!partHasActiveCustomization(partId) && !useFullFacePremade) {
            const premadeEntries = getPremadeEntriesForPart(partId);
            premadeEntries.sort((a, b) => (a.priority || -10) - (b.priority || -10));
            premadeMain = [...premadeEntries].reverse().find(e => e.image);
            premadeOpp = [...premadeEntries].reverse().find(e => e.secondImage);
        }
        if (useFullFacePremade) {
            setStackImage(stack.premade, null, null);
        } else {
            setStackImage(stack.premade, premadeMain?.image, premadeOpp?.secondImage);
        }
        syncStackLayerVisibility(stack.premade, part, true);

        const colorKey = configState[partId];
        const col = colorKey ? palette.find(c => c.key === colorKey) : null;
        setStackImage(stack.color, col?.image, col?.secondImage);
        syncStackLayerVisibility(stack.color, part, false);

        const gamemodeEntries = getGamemodeEntriesForPart(partId);
        gamemodeEntries.sort((a, b) => (a.priority || 1) - (b.priority || 1));
        const optMain = [...gamemodeEntries].reverse().find(e => e.image);
        const optOpp = [...gamemodeEntries].reverse().find(e => e.secondImage);
        setStackImage(stack.option, optMain?.image, optOpp?.secondImage);
        syncStackLayerVisibility(stack.option, part, false);

        const hasOptionOverlay = gamemodeEntries.some(e => e.image || e.secondImage);
        const targetGloss = glossLayers[partId] || [];
        targetGloss.forEach(gloss => {
            gloss.style.opacity = hasOptionOverlay ? "0" : "1";
            gloss.style.display = hasOptionOverlay ? "none" : "block";
        });
    }

    function restorePersistedSelections() {
        ensurePartStateDefaults();
        enforcePremadeCoverageClears();
        ALL_PARTS.forEach((part) => syncPartVisualState(part.id));
        setSide(currentSide === "back" ? "back" : "front");
        syncBaseImages();
        updatePartsUI();
        updateVisualizerLayers();
        updateSummary();
        saveConfigToStorage();
    }

    const DEFAULT_INITIAL_PART_ID = "shell";

    function getDefaultInitialPartId() {
        const shellPart = ALL_PARTS.find(
            (part) => part.id === DEFAULT_INITIAL_PART_ID && !part.hiddenUI && availablePartsSet.has(part.id)
        );
        if (shellPart) return shellPart.id;

        return getFirstShownPartId();
    }

    function getFirstShownPartId() {
        const firstItem = partsList ? partsList.querySelector(".parts-item:not(.disabled)") : null;
        if (firstItem && firstItem.dataset.id) return firstItem.dataset.id;

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
        let backSrc = "/assets/controller_back5.png";
        if (configState["backShellMain"] || optionState["backShellMain"]) {
            getLayerStacks("backShellMain").forEach(stack => {
                if (stack?.main?.getAttribute("src")) stack.main.style.display = "block";
                if (stack?.opp?.getAttribute("src")) stack.opp.style.display = "block";
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


    function buildPartsList() {
        if (!partsList) return;
        partsList.innerHTML = "";

        const secondaryIds = new Set(["shell", "trimpiece", "touchpad", "psButton", "allButtons"]);
        const primaryBucket = [];
        const secondaryBucket = [];

        ALL_PARTS.forEach((part, idx) => {
            if (part.hiddenUI) return;
            if (part.componentType === "premade" || !secondaryIds.has(part.id)) {
                primaryBucket.push({ part, idx });
            } else {
                secondaryBucket.push({ part, idx });
            }
        });

        [...primaryBucket, ...secondaryBucket].forEach(({ part, idx }) => {
            const row = createPartRow(part, idx);
            partsRowsById[part.id] = row;
            partsList.appendChild(row);
        });
    }

    function isPartActive(part) {
        return availablePartsSet.has(part.id);
    }

    function createPartRow(part, thumbIndex = 0) {
        const row = document.createElement("div");
        row.className = "parts-item";
        if (part.componentType === 'premade') row.classList.add('is-premade-component');
        row.dataset.id = part.id;
        row.title = part.title || ""; // Desktop tooltip
        if (!isPartActive(part)) row.classList.add("disabled");

        const thumb = document.createElement("div");
        thumb.className = "parts-thumb";
        if (part.icon) {
            const icon = document.createElement("img");
            icon.src = part.icon;
            icon.alt = part.title || ""; // Accessibility
            icon.decoding = "async";
            icon.loading = thumbIndex < 10 ? "eager" : "lazy";
            thumb.appendChild(icon);
        }

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
        if (part && part.side !== currentSide && part.componentType !== "premade") {
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
        Object.values(layers).forEach(stack => {
            if (!stack) return;
            [stack.premade, stack.color, stack.option].forEach(layerObj => {
                if (!layerObj) return;
                if (layerObj.main) layerObj.main.classList.remove("selected");
                if (layerObj.opp) layerObj.opp.classList.remove("selected");
            });
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

        if (colorPanelGrid) {
            colorPanelGrid.classList.toggle('config-premade-component-panel', part.componentType === 'premade');
        }

        const palette = getPaletteForPart(partId);
        const options = getOptionsForPart(partId);

        if (part.componentType === 'premade') {
            colorEmptyState.style.display = options.length ? 'none' : 'flex';
            if (optionsPanelGrid) optionsPanelGrid.style.display = 'none';
            if (colorPanelGrid) {
                colorPanelGrid.style.display = options.length ? 'grid' : 'none';
                buildPremadeComponentPalette(colorPanelGrid, options);
            }
            if (isMobileLayout()) updateMobileOptionsBar();
            return;
        }

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




    function clearPremadeSelection(partId) {
        if (!partId) return;
        const options = getOptionsForPart(partId);
        if (!Array.isArray(optionState[partId])) optionState[partId] = [];

        const hadPremade = optionState[partId].some(k => {
            const opt = options.find(o => o.key === k);
            return opt && opt.type === 'premade';
        });
        if (!hadPremade) return;

        playClick2();

        optionState[partId] = optionState[partId].filter(k => {
            const opt = options.find(o => o.key === k);
            return !opt || opt.type !== 'premade';
        });

        let totalPrice = 0;
        optionState[partId].forEach(k => {
            const opt = options.find(o => o.key === k);
            if (opt) totalPrice += (opt.price || 0);
        });
        selectedOptionPriceByPart[partId] = totalPrice;

        saveConfigToStorage();
        updatePartsUI();
        syncBaseImages();
        updateSummary();
        if (selectedPartId === partId) openColorPanelForPart(partId);
    }

    function buildPremadeComponentPalette(target, entries) {
        if (!target) return;
        target.innerHTML = '';

        const partId = selectedPartId;
        if (!partId) return;

        const currentSelected = Array.isArray(optionState[partId]) ? optionState[partId] : [];

        const header = document.createElement('div');
        header.className = isMobileLayout() ? 'mobile-group-title' : 'color-group-title';
        header.textContent = currentLang === 'ar' ? 'تصاميم جاهزة' : 'Pre-made Designs';
        target.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'config-premade-design-grid';

        const clearCard = document.createElement('button');
        clearCard.type = 'button';
        clearCard.className = 'config-premade-design-card config-premade-clear-card';
        clearCard.setAttribute('aria-label', t('clearPremadeSelection'));
        const clearIcon = document.createElement('div');
        clearIcon.className = 'config-premade-clear-icon';
        clearIcon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
        clearCard.appendChild(clearIcon);
        const clearMeta = document.createElement('div');
        clearMeta.className = 'config-premade-design-meta';
        const clearLabel = document.createElement('div');
        clearLabel.className = 'config-premade-design-title';
        clearLabel.textContent = currentLang === 'ar' ? 'إلغاء' : 'Clear';
        clearMeta.appendChild(clearLabel);
        clearCard.appendChild(clearMeta);
        clearCard.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearPremadeSelection(partId);
        });
        grid.appendChild(clearCard);

        entries.forEach(entry => {
            const isOutOfStock = isEntryOutOfStock(entry);
            const isSelected = currentSelected.includes(entry.key);

            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'config-premade-design-card';
            if (isSelected) card.classList.add('active');
            if (isOutOfStock) {
                card.classList.add('is-disabled');
                card.disabled = true;
            }

            const img = document.createElement('img');
            img.src = entry.icon || entry.image || entry.secondImage || '/assets/controller.png';
            img.alt = entry.valName || '';
            img.loading = 'lazy';
            img.decoding = 'async';
            card.appendChild(img);

            const meta = document.createElement('div');
            meta.className = 'config-premade-design-meta';

            const title = document.createElement('div');
            title.className = 'config-premade-design-title';
            title.textContent = entry.valName || entry.key;
            meta.appendChild(title);

            if (!isOutOfStock && entry.price > 0) {
                const price = document.createElement('div');
                price.className = 'config-premade-design-price';
                price.setAttribute('data-bhd-price', String(entry.price));
                price.textContent = formatEzMoney(entry.price);
                meta.appendChild(price);
            } else if (isOutOfStock) {
                const stock = document.createElement('div');
                stock.className = 'config-premade-design-price is-out-of-stock';
                stock.textContent = t('outOfStock') || 'Out of Stock';
                meta.appendChild(stock);
            }

            card.appendChild(meta);

            card.addEventListener('click', () => {
                if (isOutOfStock) return;
                applyOption(partId, entry.key);
            });

            grid.appendChild(card);
        });

        target.appendChild(grid);
    }

    function buildPaletteCells(target, entries, isOption) {
        if (target) target.innerHTML = "";
        const partId = selectedPartId;
        if (!partId) return;

        if (isOption) {
            const otherEntries = entries.filter(e => !e.isPremade);
            if (otherEntries.length > 0) {
                renderSection(target, otherEntries, t("availableOptions"), true);
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
            if (isOption && (entry.isGamemode || entry.isPremade)) {
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
                    const swImg = document.createElement("img");
                    swImg.className = "cd-swatch-icon-img";
                    swImg.src = entry.icon;
                    swImg.alt = "";
                    swImg.decoding = "async";
                    swImg.loading = "lazy";
                    swatch.appendChild(swImg);
                } else {
                    swatch.style.backgroundColor = entry.hex;
                }
            }

            const shouldShowPriceInside = !isOutOfStock && entry.price != null && entry.price > 0 && entry.key !== "rampkit" && !entry.isGamemode;
            const shouldShowStockInside = isOutOfStock && !entry.isGamemode;
            if (shouldShowPriceInside || shouldShowStockInside) {
                const priceLabel = document.createElement("span");
                priceLabel.className = isOutOfStock ? "swatch-price is-out-of-stock" : "swatch-price";
                if (!isOutOfStock && entry.price != null) {
                    priceLabel.setAttribute("data-bhd-price", String(entry.price));
                }
                priceLabel.textContent = isOutOfStock ?
                    (t("outOfStock") || "Out of Stock") :
                    formatEzMoney(entry.price);
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
                        if (!isOutOfStock && entry.price != null) {
                            price.setAttribute("data-bhd-price", String(entry.price));
                        }
                        price.textContent = isOutOfStock ?
                            (t("outOfStock") || "Out of Stock") :
                            formatEzMoney(entry.price);
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

        if (colObj && colObj.image) {
            queueImageWarmup(colObj.image, { priority: "high", retain: true });
        }

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

        // Pre-made design selected: clear colors/options on covered regular parts (not vice versa).
        if (!isAlreadySelected && requestedOption.type === "premade") {
            clearRegularPartsCoveredByPremade(requestedOption);
        }

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
        updatePremadeFaceOverlays();
        ALL_PARTS.forEach(part => updatePartVisualStacks(part.id));
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
        const changed = side !== currentSide;
        currentSide = side;

        if (currentSide === "back") {
            if (controllerWrapper) controllerWrapper.classList.add("is-back");
        } else {
            if (controllerWrapper) controllerWrapper.classList.remove("is-back");
        }

        updateFlipControl();
        syncBaseImages();
        updateVisualizerLayers();
        if (changed) saveConfigToStorage();
    }

    const flipBtns = document.querySelectorAll(".flip-toggle");
    if (flipBtns) {
        flipBtns.forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                setSide(currentSide === "front" ? "back" : "front");
                playClick();
            });
        });
    }
    if (flipControlBtn) {
        flipControlBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            setSide(currentSide === "front" ? "back" : "front");
            playClick();
        });
    }

    function isBaseControllerOutOfStock() {
        if (baseControllerQty == null) return false;
        return Number(baseControllerQty) <= 0;
    }

    function isBaseControllerLowStock() {
        if (baseControllerQty == null) return false;
        return Number(baseControllerQty) > 0 && Number(baseControllerQty) <= baseControllerLowStockThreshold;
    }

    function updateAddToCartAvailability() {
        if (!addToCartBtn) return;
        const out = isBaseControllerOutOfStock();
        addToCartBtn.disabled = out;
        addToCartBtn.title = out ? (t("outOfStock") || "Out of Stock") : "";
        addToCartBtn.classList.toggle("is-out-of-stock", out);
    }

    function updateSummary() {
        let total = baseControllerPrice || 0;
        ALL_PARTS.forEach(p => {
            total += (selectedPriceByPart[p.id] || 0);
            total += (selectedOptionPriceByPart[p.id] || 0);
        });

        const formatted = formatEzMoney(total);
        if (summaryAmountEl) summaryAmountEl.textContent = formatted;
        const alt = document.getElementById("summaryAmountAlt");
        if (alt) alt.textContent = formatted;
        updateAddToCartAvailability();
    }

    function refreshEzCurrencyLabels() {
        document.querySelectorAll("[data-bhd-price]").forEach((el) => {
            const raw = el.getAttribute("data-bhd-price");
            if (raw == null || raw === "") return;
            el.textContent = formatEzMoney(Number(raw));
        });
        updateSummary();
    }

    window.addEventListener("ez-currency-change", refreshEzCurrencyLabels);

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
            optionState[p.id] = [];
            selectedPriceByPart[p.id] = 0;
            selectedOptionPriceByPart[p.id] = 0;
        });

        // Hide all layers
        Object.keys(layers).forEach(pid => {
            getLayerStacks(pid).forEach(layerObj => {
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

            const currentOptions = Array.isArray(optionState[pid]) ? optionState[pid] : [];
            const selectedOptions = [];
            currentOptions.forEach(okey => {
                const o = options.find(opt => opt.key === okey);
                if (o) selectedOptions.push(JSON.parse(JSON.stringify(o)));
            });

            const isTrans = (pid !== "allButtons") && (colorObj && colorObj.isTransparent);

            snapshot.parts[pid] = {
                color: colorObj ? JSON.parse(JSON.stringify(colorObj)) : null,
                option: selectedOptions[0] || null, // Keep legacy field for compat
                options: selectedOptions, // New field for all selected options
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
            if (isBaseControllerOutOfStock()) {
                alert(t("outOfStock") || "Out of Stock");
                return;
            }
            const snapshot = getSnapshot();
            const hasCustom = Object.values(snapshot.parts).some(p => p.color || (p.option && p.option.key !== "standard"));
            if (!hasCustom) {
                alert(t("alertNone"));
                return;
            }

            setZohoLoading(true);
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
                setZohoLoading(false);
                addToCartBtn.disabled = false;
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
