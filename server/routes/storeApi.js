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
      const baseRow = await dao.getRow(pool, "configurator_settings/general");
      if (baseRow && baseRow.data) {
        basePrice = Number(baseRow.data.basePrice) || 0;
      }

      res.json(
        rewriteFirebaseMediaUrlsIfConfigured({
          parts: partsList,
          basePrice
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

  return r;
};
