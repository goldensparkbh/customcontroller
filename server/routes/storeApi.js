"use strict";

const crypto = require("crypto");
const express = require("express");
const dao = require("../lib/documentsDao");
const { rewriteFirebaseMediaUrlsIfConfigured } = require("../lib/assetUrlRewrite.cjs");
const { getMaintenanceStatus } = require("../lib/maintenanceMode.cjs");
const { getExchangeRates } = require("../lib/exchangeRates.cjs");
const { suggestCurrencyForRequest } = require("../lib/geoCurrency.cjs");

module.exports = function createStoreApi(pool) {
  const r = express.Router();

  r.get("/site/status", async (_req, res) => {
    try {
      const status = await getMaintenanceStatus(pool);
      res.json(status);
    } catch (err) {
      console.error("[site status]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  r.get("/exchange-rates", async (_req, res) => {
    try {
      const payload = await getExchangeRates();
      res.json(payload);
    } catch (err) {
      console.error("[exchange-rates]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  r.get("/geo/currency", async (req, res) => {
    try {
      const hint = await suggestCurrencyForRequest(req);
      res.json(hint);
    } catch (err) {
      console.error("[geo currency]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  /*
   * POS (public parity with legacy client Firestore: catalog read + single order write).
   */
  r.get("/pos/catalog", async (_req, res) => {
    try {
      const itemRows = await dao.pathsRegex(pool, "^items/[^/]+$");
      const artistRows = await dao.pathsRegex(pool, "^artist_products/[^/]+$");
      const partRows = await dao.pathsRegex(pool, "^configurator_parts/[^/]+$");

      const items = [];
      itemRows.forEach((row) => {
        const m = row.path.match(/^items\/([^/]+)$/u);
        if (!m) return;
        const docSnapId = m[1];
        const it = row.data || {};
        items.push({
          id: docSnapId,
          name: it.name || "",
          sku: it.barcode || it.itemNumber || docSnapId,
          price: Number(it.sellPrice || it.price || 0) || 0,
          stock: it.quantity || 0,
          category: it.category || "General",
          image: it.images?.[0] || null,
          isCustom: false
        });
      });

      artistRows.forEach((row) => {
        const m = row.path.match(/^artist_products\/([^/]+)$/u);
        if (!m) return;
        const it = row.data || {};
        if (it.showOnline === false || it.active === false) return;
        const images = Array.isArray(it.images) && it.images.length ? it.images : [it.image].filter(Boolean);
        items.push({
          id: m[1],
          name: it.nameEn || it.name || "",
          sku: it.barcode || it.itemNumber || m[1],
          price: Number(it.sellPrice || it.price || 0) || 0,
          stock: it.quantity || 0,
          category: it.category || "Artists",
          image: images[0] || null,
          isCustom: false,
          inventoryDocPath: `artist_products/${m[1]}`,
          productKind: "artist",
          skipBaseController: true
        });
      });

      const parts = [];
      partRows.forEach((row) => {
        const m = row.path.match(/^configurator_parts\/([^/]+)$/u);
        if (!m) return;
        const docSnapId = m[1];
        const p = row.data || {};
        parts.push({
          id: docSnapId,
          name: p.title || p.name || "Custom Part",
          sku: `PART-${docSnapId}`,
          price: 0,
          stock: 999,
          category: "Customization",
          image: p.icon || null,
          isCustom: true
        });
      });

      res.json(rewriteFirebaseMediaUrlsIfConfigured({ items, parts }));
    } catch (err) {
      console.error("[pos catalog]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  function publicArtistProduct(id, data) {
    if (!data || data.showOnline === false || data.active === false) return null;
    const images = Array.isArray(data.images) && data.images.length
      ? data.images.filter(Boolean)
      : [data.image].filter(Boolean);
    const price = Number(data.sellPrice != null ? data.sellPrice : data.price) || 0;
    return {
      id,
      category: data.category || "premium",
      price,
      quantity: Number(data.quantity) || 0,
      image: images[0] || "",
      gallery: images,
      nameEn: data.nameEn || data.name || "",
      nameAr: data.nameAr || data.nameEn || data.name || "",
      artistEn: data.artistEn || "",
      artistAr: data.artistAr || data.artistEn || "",
      categoryEn: data.categoryEn || "",
      categoryAr: data.categoryAr || "",
      cardEn: data.cardEn || data.description || "",
      cardAr: data.cardAr || data.cardEn || data.description || "",
      bioEn: data.bioEn || "",
      bioAr: data.bioAr || data.bioEn || "",
      storyEn: data.storyEn || "",
      storyAr: data.storyAr || data.storyEn || "",
      itemNumber: data.itemNumber || "",
      barcode: data.barcode || "",
      inventoryDocPath: `artist_products/${id}`,
      skipBaseController: true,
      productKind: "artist"
    };
  }

  r.get("/artists/categories", async (_req, res) => {
    try {
      const rows = await dao.pathsRegex(pool, "^artist_categories/[^/]+$");
      const categories = [];
      rows.forEach((row) => {
        const m = row.path.match(/^artist_categories\/([^/]+)$/u);
        if (!m) return;
        const data = row.data || {};
        const id = String(data.id || m[1] || "").trim();
        if (!id || id === "all") return;
        categories.push({
          id,
          en: data.en || data.categoryEn || "",
          ar: data.ar || data.categoryAr || data.en || "",
          sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0
        });
      });
      categories.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return String(a.en).localeCompare(String(b.en));
      });
      res.json({ categories });
    } catch (err) {
      console.error("[artist categories]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  r.get("/artists/catalog", async (_req, res) => {
    try {
      const rows = await dao.pathsRegex(pool, "^artist_products/[^/]+$");
      const products = [];
      rows.forEach((row) => {
        const m = row.path.match(/^artist_products\/([^/]+)$/u);
        if (!m) return;
        const product = publicArtistProduct(m[1], row.data || {});
        if (product) products.push(product);
      });
      products.sort((a, b) => String(a.nameEn).localeCompare(String(b.nameEn)));
      res.json(rewriteFirebaseMediaUrlsIfConfigured({ products }));
    } catch (err) {
      console.error("[artists catalog]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  r.get("/artists/:id", async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ error: "bad_id" });
      const row = await dao.getRow(pool, `artist_products/${id}`);
      const product = publicArtistProduct(id, row && row.data ? row.data : null);
      if (!product) return res.status(404).json({ error: "not_found" });
      res.json(rewriteFirebaseMediaUrlsIfConfigured(product));
    } catch (err) {
      console.error("[artist product]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  r.post("/pos/orders", async (req, res) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      if (!Array.isArray(body.items)) return res.status(400).json({ error: "invalid_order" });

      const id = crypto.randomUUID();
      const path = `pos_orders/${id}`;
      const stamp = typeof body.timestamp === "string" ? body.timestamp : new Date().toISOString();

      await dao.upsert(pool, path, {
        ...body,
        timestamp: stamp,
        createdAt: stamp,
        updatedAt: stamp
      });

      res.status(201).json({ ok: true, id, path });
    } catch (err) {
      console.error("[pos order]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  /*
   * Public catalog identical shape to legacy Configurator `loadFirebaseData`
   */
  r.get("/configurator/catalog", async (_req, res) => {
    try {
      const partRows = await dao.pathsRegex(pool, "^configurator_parts/[^/]+$");
      const optRows = await dao.pathsRegex(pool, "^configurator_parts/[^/]+/options/[^/]+$");
      const optsByPart = new Map();

      optRows.forEach((row) => {
        const m = row.path.match(/^configurator_parts\/([^/]+)\/options\/([^/]+)$/u);
        if (!m) return;
        const partId = m[1];
        const optId = m[2];
        const list = optsByPart.get(partId) || [];
        list.push({ id: optId, ...(row.data || {}) });
        optsByPart.set(partId, list);
      });

      const partsList = [];
      partRows.forEach((row) => {
        const m = row.path.match(/^configurator_parts\/([^/]+)$/u);
        if (!m) return;
        const id = m[1];
        const data = row.data || {};
        const options = optsByPart.get(id) || [];
        partsList.push({ id, ...data, options });
      });

      let basePrice = 0;
      let baseQuantity = null;
      let basePurchasePrice = 0;
      const baseRow = await dao.getRow(pool, "configurator_settings/general");
      if (baseRow && baseRow.data) {
        basePrice = Number(baseRow.data.basePrice) || Number(baseRow.data.sellPrice) || 0;
        if (baseRow.data.quantity != null) baseQuantity = Number(baseRow.data.quantity) || 0;
        basePurchasePrice = Number(baseRow.data.purchasePrice) || 0;
      }

      let baseControllerLowStockThreshold = 5;
      const adminSettingsRow = await dao.getRow(pool, "admin_settings/general");
      if (adminSettingsRow && adminSettingsRow.data) {
        const t = Number(adminSettingsRow.data.baseControllerLowStockThreshold);
        if (Number.isFinite(t) && t >= 0) baseControllerLowStockThreshold = t;
      }

      res.json(
        rewriteFirebaseMediaUrlsIfConfigured({
          parts: partsList,
          basePrice,
          baseQuantity,
          basePurchasePrice,
          baseControllerLowStockThreshold
        })
      );
    } catch (err) {
      console.error("[store catalog]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  /*
   * merge target for `TRANSLATION_OVERRIDES_DOC`
   */
  r.get("/i18n/overrides", async (_req, res) => {
    try {
      const row = await dao.getRow(pool, "admin_settings/translation_overrides");
      const entries = row && row.data && typeof row.data.entries === "object" ? row.data.entries : {};
      res.json({ entries });
    } catch (err) {
      console.error("[i18n]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  r.get("/homepage/banners", async (_req, res) => {
    try {
      const row = await dao.getRow(pool, "admin_settings/home_banners");
      const data = row && row.data && typeof row.data === "object" ? row.data : {};
      const sortList = (list) => {
        const arr = Array.isArray(list) ? list : [];
        return arr
          .filter((item) => item && item.enabled !== false)
          .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
      };
      res.json(
        rewriteFirebaseMediaUrlsIfConfigured({
          ar: sortList(data.ar),
          en: sortList(data.en),
          updatedAt: data.updatedAt || null,
        })
      );
    } catch (err) {
      console.error("[homepage banners]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  return r;
};
