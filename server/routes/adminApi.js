"use strict";

const crypto = require("crypto");
const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const dao = require("../lib/documentsDao");
const hooks = require("../lib/orderInventoryHooks");
const { rewriteFirebaseMediaUrlsIfConfigured } = require("../lib/assetUrlRewrite.cjs");
const { invalidateMaintenanceCache } = require("../lib/maintenanceMode.cjs");
const { maybeOptimizeRasterUpload } = require("../lib/uploadImageOptimize.cjs");

module.exports = function createAdminApi(pool, handlers) {
  const r = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Number(process.env.UPLOAD_LIMIT_MB || 12) * 1024 * 1024 }
  });

  function safePath(p) {
    const s = String(p || "").replace(/^\/*/, "").trim();
    if (!s || s.includes("..") || s.includes("\0")) return null;
    return s;
  }

  function requireAdmin(req, res, next) {
    const raw = req.signedCookies && req.signedCookies.ezadm;
    if (!raw) return res.status(401).json({ error: "Unauthorized" });
    try {
      const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!payload.uid) throw new Error("bad");
      req.adminUser = payload;
      next();
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  /*
   * --------------------------------------------------------------------------
   */

  r.post("/auth/login", async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      if (!email || !password) return res.status(400).json({ error: "invalid" });

      const { rows } = await pool.query("SELECT id, email, password_hash FROM admin_users WHERE email=$1", [email]);
      const row = rows[0];
      if (!row) return res.status(401).json({ error: "Invalid credentials" });
      const ok = await bcrypt.compare(password, row.password_hash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      const payload = JSON.stringify({ uid: row.id, email: row.email });
      res.cookie("ezadm", payload, {
        httpOnly: true,
        signed: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({ ok: true, email: row.email });
    } catch (err) {
      console.error("[login]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  r.post("/auth/logout", (req, res) => {
    res.clearCookie("ezadm", {
      signed: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production"
    });
    res.json({ ok: true });
  });

  r.get("/auth/me", requireAdmin, (req, res) => {
    res.json({ ok: true, email: req.adminUser.email });
  });

  /*
   * --------------------------------------------------------------------------
   */

  r.get("/docs", requireAdmin, async (req, res) => {
    try {
      const prefixRaw = req.query.prefix;
      let prefix = String(prefixRaw || "");
      prefix = prefix.replace(/^\/*/, "").replace(/\/*$/u, "");
      if (!prefix) return res.status(400).json({ error: "missing_prefix" });
      const prefixPath = `${prefix}/`;
      const orderBy = String(req.query.orderBy || "");
      const orderDesc = orderBy === "createdAt";
      const rows = await dao.listPrefix(pool, prefixPath, orderDesc ? "createdAt" : null);
      const docsPayload = rewriteFirebaseMediaUrlsIfConfigured({
        docs: rows.map(({ path: docPath, data }) => ({
          path: docPath,
          id: docPath.split("/").pop(),
          ...data
        }))
      });
      res.json({ docs: docsPayload.docs });
    } catch (err) {
      console.error("[docs list]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  r.get("/doc", requireAdmin, async (req, res) => {
    try {
      const p = safePath(req.query.path);
      if (!p) return res.status(400).json({ error: "bad_path" });
      const row = await dao.getRow(pool, p);
      if (!row) return res.status(404).json({ error: "not_found" });
      res.json(
        rewriteFirebaseMediaUrlsIfConfigured({
          path: row.path,
          id: row.path.split("/").pop(),
          ...row.data
        })
      );
    } catch (err) {
      console.error("[doc get]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  r.patch("/doc", requireAdmin, async (req, res) => {
    try {
      const p = safePath(req.query.path || req.body.path);
      if (!p) return res.status(400).json({ error: "bad_path" });
      const prevRow = await dao.getRow(pool, p);
      const merged = await dao.mergeShallow(pool, p, req.body && typeof req.body === "object" ? req.body : {});
      await hooks.maybeRunOrderUpdate(handlers, prevRow?.data ?? null, merged, p);
      if (p === "admin_settings/general") invalidateMaintenanceCache();
      if (p === "configurator_settings/general" && typeof handlers.maybeSendBaseControllerLowStockAlert === "function") {
        try {
          const settingsRow = await dao.getRow(pool, "admin_settings/general");
          await handlers.maybeSendBaseControllerLowStockAlert({
            prevData: prevRow?.data ?? null,
            nextData: merged,
            settings: settingsRow?.data || {},
            req
          });
        } catch (alertErr) {
          console.error("[doc patch] base controller low stock alert", alertErr);
        }
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("[doc patch]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  r.put("/doc", requireAdmin, async (req, res) => {
    try {
      const p = safePath(req.query.path || req.body.path);
      if (!p) return res.status(400).json({ error: "bad_path" });
      const prevRow = await dao.getRow(pool, p);
      const incoming = req.body && typeof req.body.data === "object" ? req.body.data : {};
      await dao.replace(pool, p, incoming);
      const afterRow = await dao.getRow(pool, p);
      await hooks.maybeRunOrderUpdate(handlers, prevRow?.data ?? null, afterRow?.data ?? {}, p);
      if (p === "admin_settings/general") invalidateMaintenanceCache();
      res.json({ ok: true });
    } catch (err) {
      console.error("[doc put]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  r.delete("/doc", requireAdmin, async (req, res) => {
    try {
      const p = safePath(req.query.path);
      if (!p) return res.status(400).json({ error: "bad_path" });
      const prevRow = await dao.deletePath(pool, p);
      if (prevRow) await hooks.maybeRunOrderDelete(handlers, prevRow.data, p);
      res.json({ ok: true });
    } catch (err) {
      console.error("[doc del]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  /*
   * Create generic document `{ collection, docId?, data }`
   */
  r.post("/doc", requireAdmin, async (req, res) => {
    try {
      let fullPath = safePath(req.body.path);
      if (!fullPath) {
        const coll = safePath(req.body.collection);
        if (!coll) return res.status(400).json({ error: "bad_collection" });
        const rawId = req.body.docId != null ? String(req.body.docId).trim() : "";
        const id =
          rawId ?
            rawId.replace(/^\/+|\/+$/gu, "").replace(/^\.+/u, "").slice(0, 750) ||
              (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex")) :
            (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"));
        fullPath = `${coll}/${id}`;
      }
      const incoming = typeof req.body.data === "object" && req.body.data ? req.body.data : {};
      await dao.mergeShallow(pool, fullPath, { ...incoming, createdAt: incoming.createdAt || new Date().toISOString() });
      res.status(201).json({ ok: true, path: fullPath, id: fullPath.split("/").pop() });
    } catch (err) {
      console.error("[doc post]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  /*
   * Firestore-ish batch deletes
   */
  r.post("/batch", requireAdmin, async (req, res) => {
    try {
      const dels = Array.isArray(req.body.deletes) ? req.body.deletes : [];
      for (const dp of dels) {
        const p = safePath(dp);
        if (!p) continue;
        const prev = await dao.deletePath(pool, p);
        if (prev) await hooks.maybeRunOrderDelete(handlers, prev.data, p);
      }

      /*
       * merges: [{path, patch}]
       */
      const merges = Array.isArray(req.body.merges) ? req.body.merges : [];
      for (const m of merges) {
        const p = safePath(m.path);
        if (!p || typeof m.patch !== "object" || !m.patch) continue;
        const prevRow = await dao.getRow(pool, p);
        const merged = await dao.mergeShallow(pool, p, m.patch);
        await hooks.maybeRunOrderUpdate(handlers, prevRow?.data ?? null, merged, p);
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("[batch]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  /*
   * counter
   */
  r.post("/counter/next", requireAdmin, async (req, res) => {
    try {
      const counterKey = String(req.body.counterKey || req.body.key || "").trim();
      const startAt = Number(req.body.startAt);
      if (!counterKey) return res.status(400).json({ error: "bad_key" });
      const next = await dao.allocateCounter(pool, counterKey, Number.isFinite(startAt) ? startAt : 1);
      res.json({ value: next });
    } catch (err) {
      console.error("[counter]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  /*
   * optional inventory hook job (cron)
   */
  r.post("/cron/abandoned-reminders", async (req, res) => {
    const secret = String(process.env.CRON_SECRET || "").trim();
    if (!secret || req.get("x-cron-secret") !== secret) return res.status(403).send("Forbidden");
    try {
      await handlers.runAbandonedCartReminderJob();
      res.json({ ok: true });
    } catch (err) {
      console.error("[cron]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  /*
   * upload -> Spaces/S3-compatible
   */
  r.post("/upload", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      const endpoint = String(process.env.DO_SPACES_ENDPOINT || "").trim();
      const keyId = String(process.env.DO_SPACES_KEY || "").trim();
      const secret = String(process.env.DO_SPACES_SECRET || "").trim();
      const Bucket = String(process.env.DO_SPACES_BUCKET || "").trim();
      const publicBase = String(process.env.DO_SPACES_PUBLIC_BASE_URL || "").trim();

      if (!endpoint || !keyId || !secret || !Bucket) {
        return res.status(503).json({
          error: "storage_not_configured",
          hint: "Set DO_SPACES_ENDPOINT/KEY/SECRET/BUCKET (+ optional PUBLIC_BASE_URL)"
        });
      }

      if (!req.file || !req.file.buffer) return res.status(400).json({ error: "missing_file" });

      const imageProfile = String(req.body?.imageProfile || "default").trim() || "default";
      let uploadBody = req.file.buffer;
      let contentType = req.file.mimetype || "application/octet-stream";
      let ext = path.extname(req.file.originalname || "").replace(/[^.a-z0-9]/giu, "");

      const optimized = await maybeOptimizeRasterUpload(uploadBody, contentType, imageProfile);
      if (optimized) {
        uploadBody = optimized.buffer;
        contentType = optimized.contentType;
        ext = optimized.ext || ".webp";
      } else if (!ext) {
        const mt = String(contentType || "").split(";")[0].trim().toLowerCase();
        if (mt === "image/jpeg") ext = ".jpg";
        else if (mt === "image/png") ext = ".png";
        else if (mt === "image/webp") ext = ".webp";
        else if (mt === "image/gif") ext = ".gif";
        else ext = ".bin";
      }

      const fname = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
      const Key = `${String(process.env.DO_SPACES_UPLOAD_PREFIX || "uploads").replace(/\/+$/, "")}/${fname}`;

      const s3 = new S3Client({
        region: "us-east-1",
        endpoint,
        credentials: {
          accessKeyId: keyId,
          secretAccessKey: secret
        },
        forcePathStyle: process.env.DO_SPACES_FORCE_PATH_STYLE !== "false"
      });

      await s3.send(
        new PutObjectCommand({
          Bucket,
          Key,
          Body: uploadBody,
          ContentType: contentType,
          ACL: process.env.DO_SPACES_PUBLIC_ACL || "public-read",
          CacheControl: process.env.DO_SPACES_UPLOAD_CACHE_CONTROL || "public, max-age=31536000, immutable"
        })
      );

      /*
       * Canonical public URL variants
       */
      const urlPub =
        String(publicBase).replace(/\/+$/, "") ? `${String(publicBase).replace(/\/+$/, "")}/${Key}` :
        `${endpoint.replace(/\/+$/, "")}/${Bucket}/${Key}`;

      res.json({ url: urlPub, Key });
    } catch (err) {
      console.error("[upload]", err);
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  return r;
};
