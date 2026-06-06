"use strict";

/**
 * Compare order docs in Firestore vs Postgres (documents table).
 * Usage: node scripts/compare-firebase-postgres-orders.cjs [limit]
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const admin = require("firebase-admin");
const { Pool } = require("pg");
const { poolOptions } = require("../lib/pgPoolOptions.cjs");

function loadServiceAccount() {
  const literal = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (literal) return JSON.parse(literal);
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!p) throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS");
  const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) out[k] = obj?.[k];
  return out;
}

async function listAllFirestoreOrders(db) {
  const out = [];
  let last = null;
  const pageSize = 500;
  for (;;) {
    let q = db.collection("orders").orderBy("__name__").limit(pageSize);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      out.push({ id: doc.id, path: doc.ref.path, data: doc.data(), updateTime: doc.updateTime });
      last = doc;
    }
    if (snap.size < pageSize) break;
  }
  return out;
}

async function main() {
  const limit = Number(process.argv[2] || 15);
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");

  const sa = loadServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();
  const pool = new Pool(poolOptions(process.env.DATABASE_URL));

  console.log("Firebase project_id:", sa.project_id);
  console.log("Postgres host:", (process.env.DATABASE_URL.match(/@([^/]+)/) || [])[1] || "(unknown)");

  const fbOrders = await listAllFirestoreOrders(db);
  const { rows: pgRows } = await pool.query(
    `SELECT path, data, updated_at FROM documents WHERE path LIKE 'orders/%' ORDER BY updated_at DESC NULLS LAST`
  );
  const pgByPath = new Map(pgRows.map((r) => [r.path, r]));

  console.log("\nCounts:");
  console.log("  Firestore orders:", fbOrders.length);
  console.log("  Postgres orders/:", pgRows.length);

  const fbOnly = fbOrders.filter((o) => !pgByPath.has(o.path));
  const pgOnly = pgRows.filter((r) => !fbOrders.some((o) => o.path === r.path));
  console.log("  In Firestore only:", fbOnly.length);
  console.log("  In Postgres only:", pgOnly.length);

  const fields = ["paymentStatus", "status", "total", "orderNumber"];
  const mismatches = [];
  for (const fb of fbOrders) {
    const pg = pgByPath.get(fb.path);
    if (!pg) continue;
    const a = pick(fb.data, fields);
    const b = pick(pg.data, fields);
    const same = JSON.stringify(a) === JSON.stringify(b);
    if (!same) mismatches.push({ id: fb.id, path: fb.path, firestore: a, postgres: b });
  }

  console.log("\nBusiness-field mismatches (paymentStatus, status, total, orderNumber):", mismatches.length);
  mismatches
    .sort((x, y) => String(y.firestore.updatedAt || "").localeCompare(String(x.firestore.updatedAt || "")))
    .slice(0, limit)
    .forEach((m) => {
      console.log("\n---", m.path);
      console.log("  Firestore:", JSON.stringify(m.firestore));
      console.log("  Postgres: ", JSON.stringify(m.postgres));
    });

  if (fbOnly.length) {
    console.log("\nSample Firestore-only (new, not in Postgres):");
    fbOnly.slice(0, 5).forEach((o) => {
      console.log(" ", o.path, pick(o.data, fields));
    });
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
