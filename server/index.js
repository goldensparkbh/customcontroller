"use strict";

/*
 * DigitalOcean / self-hosted backend: Postgres (Firestore-compat) + generated commerce HTTP handlers (ex–Firebase Functions).
 */

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { Pool } = require("pg");

const { poolOptions } = require("./lib/pgPoolOptions.cjs");
const { PgFirestore } = require("./lib/commerce/pgFirestore");
const handlers = require("./lib/commerce/handlers.generated.cjs");

const ROOT = path.join(__dirname, "..");

function pickEnv(...candidates) {
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

const envPrimary = pickEnv(
  path.join(__dirname, ".env"),
  path.join(ROOT, "functions", ".env"),
  path.join(ROOT, ".env")
);

require("dotenv").config(envPrimary ? { path: envPrimary } : {});

const PORT = Number(process.env.PORT || 8787);
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[server] DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({
  ...poolOptions(DATABASE_URL),
  max: Number(process.env.PG_POOL_MAX || 10)
});

const commerceDb = new PgFirestore(pool);
handlers.injectCommerceDb(commerceDb);

const createStoreApi = require("./routes/storeApi");
const createAdminApi = require("./routes/adminApi");
const { createMaintenanceMiddleware } = require("./lib/maintenanceMode.cjs");

const app = express();
app.disable("x-powered-by");
app.use(
  cors({
    origin: process.env.CORS_ORIGIN === "*" ? true : process.env.CORS_ORIGIN || true,
    credentials: true
  })
);
if (!process.env.COOKIE_SECRET && process.env.NODE_ENV === "production") {
  console.error("[server] COOKIE_SECRET is required in production.");
  process.exit(1);
}
app.use(cookieParser(process.env.COOKIE_SECRET || "dev-secret-change-me"));
app.use(
  express.json({
    limit: "10mb",
    verify(req, _res, buf) {
      req.rawBody = Buffer.from(buf);
    }
  })
);

app.get("/health", (_req, res) => res.status(200).send("ok"));

app.use(createMaintenanceMiddleware(pool));

app.use("/store-api", createStoreApi(pool));
app.use("/admin-api", createAdminApi(pool, handlers));

function mountHttpsHandler(fn) {
  return (req, res) => Promise.resolve(fn(req, res)).catch((err) => {
    console.error("[handler]", err);
    res.status(500).json({ error: err.message || String(err) });
  });
}

app.use("/zoho", mountHttpsHandler(handlers.zohoProxy));

app.use("/api/tap/verify", mountHttpsHandler(handlers.tapVerificationHandler));
app.use("/api/tap", (req, res) => {
  if (req.method !== "OPTIONS" && req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }
  return mountHttpsHandler(handlers.tapPaymentHandler)(req, res);
});

app.use("/api/orderPreview", mountHttpsHandler(handlers.orderPreview));
app.use("/api", mountHttpsHandler(handlers.orderHandler));

app.use((req, res) => {
  res.status(404).send("Not found");
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
