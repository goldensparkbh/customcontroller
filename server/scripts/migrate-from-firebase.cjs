"use strict";

/**
 * Copy Firestore + (optionally) Firebase Storage objects into Postgres `documents`
 * table + DigitalOcean Spaces.
 *
 * Prereqs:
 *   DATABASE_URL                              — Postgres connection string
 *   GOOGLE_APPLICATION_CREDENTIALS           — path to Firebase service-account JSON OR
 *   FIREBASE_SERVICE_ACCOUNT_JSON          — literal JSON object string
 *
 * After migrating files set DO_SPACES_PUBLIC_BASE_URL (+ same DO_SPACES_KEY_PREFIX / migrated)
 * on the Express server so /store-api/configurator/catalog can rewrite Firebase download URLs → Spaces URLs.
 *
 * Optional Storage → Spaces:
 *   DO_SPACES_ENDPOINT, DO_SPACES_KEY, DO_SPACES_SECRET, DO_SPACES_BUCKET
 *   SKIP_SPACES_UPLOAD=1                     — omit Firebase Storage → Spaces step
 *   MIGRATE_REWRITE_DOWNLOAD_URL=true        — naive string rewrite in stored JSON (risky); default false.
 *
 * TLS (DigitalOcean Postgres — if you see SELF_SIGNED_CERT_IN_CHAIN):
 *   DATABASE_SSL_CA_PATH=./ca-certificate.crt   — CA from DB connection page (recommended)
 *   DATABASE_SSL_REJECT_UNAUTHORIZED=false    — migration-only; skips cert verify
 *
 * Incremental sync:
 *   MIGRATE_COLLECTIONS=orders,items     — only these top-level collections (comma-separated)
 *   SKIP_SPACES_UPLOAD=1                 — Firestore-only (faster for order/payment updates)
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Pool } = require("pg");
const { poolOptions } = require("../lib/pgPoolOptions.cjs");
const admin = require("firebase-admin");
const { FieldPath } = require("firebase-admin/firestore");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const PAGE_SIZE = Math.min(Math.max(Number(process.env.MIGRATE_PAGE_SIZE || 400), 50), 1000);

function loadServiceAccount() {
  const literal = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (literal) return JSON.parse(literal);

  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!p) throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS");
  const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function isFirestoreTimestamp(v) {
  return v && typeof v === "object" && typeof v.toDate === "function" && typeof v.seconds === "number";
}

function coerceJsonValue(v, seen = new WeakMap()) {
  if (v == null) return v;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString();
  if (isFirestoreTimestamp(v)) return v.toDate().toISOString();

  if (Array.isArray(v)) return v.map((item) => coerceJsonValue(item, seen));

  if (typeof v === "object") {
    /*
     * Plain object / map
     */

    /*
     * Firestore DocumentReference
     */
    if (typeof v.path === "string" && v.collection && typeof v.collection === "function") {
      return { __refPath: String(v.path) };
    }

    if (seen.has(v)) return null;
    seen.set(v, true);
    const out = {};

    /*
     * best-effort: iterate enumerable keys only
     */
    for (const k of Object.keys(v)) {
      out[k] = coerceJsonValue(v[k], seen);
    }
    return out;
  }

  return String(v);
}

function parseCollectionFilter() {
  const raw = String(process.env.MIGRATE_COLLECTIONS || "").trim();
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length ? new Set(ids) : null;
}

async function upsertDocument(pool, docSnap, stats) {
  const fp = docSnap.ref.path;
  const data = coerceJsonValue(docSnap.data() || {});
  const createdAt = docSnap.createTime?.toDate?.() || null;
  const updatedAt = docSnap.updateTime?.toDate?.() || new Date();

  await pool.query(
    `
      INSERT INTO documents(path, data, created_at, updated_at)
      VALUES ($1, $2::jsonb, COALESCE($3, now()), COALESCE($4, now()))
      ON CONFLICT (path)
      DO UPDATE SET
        data = EXCLUDED.data,
        created_at = COALESCE(EXCLUDED.created_at, documents.created_at),
        updated_at = EXCLUDED.updated_at
    `,
    [fp, JSON.stringify(data), createdAt, updatedAt]
  );
  stats.docs += 1;
}

/*
 * Paginate — Firestore returns at most ~10k docs per query; large collections need pages.
 */
async function migrateCollection(collRef, pool, stats) {
  let last = null;

  for (;;) {
    let q = collRef.orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      await upsertDocument(pool, doc, stats);
      const subs = await doc.ref.listCollections();
      for (const sub of subs) {
        await migrateCollection(sub, pool, stats);
      }
      last = doc;
    }

    if (snap.size < PAGE_SIZE) break;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");

  /** @type {boolean} */
  let storageFailed = false;

  admin.initializeApp({
    credential: admin.credential.cert(loadServiceAccount())
  });

  const db = admin.firestore();
  const pool = new Pool(poolOptions(process.env.DATABASE_URL));
  const stats = { docs: 0 };
  const onlyCollections = parseCollectionFilter();

  const roots = await db.listCollections();

  /*
   * Top-level migrations
   */
  for (const col of roots) {
    if (onlyCollections && !onlyCollections.has(col.id)) continue;
    console.log("collection", col.id);
    await migrateCollection(col, pool, stats);
  }

  console.log("[firestore] Upserted", stats.docs, "document(s).");

  /*
   * Optional storage copy (Spaces). Firestore is already done when this runs.
   * InvalidAccessKeyId => wrong DO_SPACES_KEY / DO_SPACES_SECRET or stray quotes in .env.
   * To skip: unset DO_SPACES_BUCKET or set SKIP_SPACES_UPLOAD=1
   */
  const Bucket = (process.env.FIREBASE_STORAGE_BUCKET || "").trim() || undefined;
  const spacesBucket = (process.env.DO_SPACES_BUCKET || "").trim();
  const skipSpaces = process.env.SKIP_SPACES_UPLOAD === "1" || process.env.SKIP_SPACES_UPLOAD === "true";

  if (Bucket && spacesBucket && !skipSpaces) {
    const endpoint = (process.env.DO_SPACES_ENDPOINT || "").trim();
    const accessKeyId = (process.env.DO_SPACES_KEY || "").trim();
    const secretAccessKey = (process.env.DO_SPACES_SECRET || "").trim();
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      console.warn(
        "[storage] Skipping Spaces upload: set DO_SPACES_ENDPOINT, DO_SPACES_KEY, DO_SPACES_SECRET (or SKIP_SPACES_UPLOAD=1)."
      );
    } else {
      try {
        const bucket = admin.storage().bucket(Bucket);
        const [files] = await bucket.getFiles();

        const s3 = new S3Client({
          region: "us-east-1",
          endpoint,
          credentials: { accessKeyId, secretAccessKey },
          forcePathStyle: process.env.DO_SPACES_FORCE_PATH_STYLE !== "false"
        });

        for (const file of files) {
          if (/\/$/u.test(file.name)) continue;

          const [buf] = await file.download();
          const Key = `${String(process.env.DO_SPACES_KEY_PREFIX || "migrated").replace(/\/+$/, "")}/${file.name.replace(/^\/+/u, "")}`;

          await s3.send(
            new PutObjectCommand({
              Bucket: spacesBucket,
              Key,
              Body: Buffer.from(buf),
              ContentType: file.metadata?.contentType || "application/octet-stream",
              ACL: process.env.DO_SPACES_PUBLIC_ACL || "public-read"
            })
          );
        }
        console.log("[storage] Copied", files.length, "objects to Spaces.");
      } catch (err) {
        storageFailed = true;
        console.error(
          "[storage] Spaces upload failed (Firestore data in Postgres is OK). Fix DO_SPACES_KEY / DO_SPACES_SECRET in DigitalOcean → API → Spaces Keys (no quotes in .env), or SKIP_SPACES_UPLOAD=1."
        );
        console.error(err.message || err);
      }
    }
  } else if (Bucket && skipSpaces) {
    console.log("[storage] Skipped (SKIP_SPACES_UPLOAD).");
  }

  await pool.end();
  if (storageFailed) {
    console.error("Migration finished with STORAGE errors — exit code 1.");
    process.exit(1);
  }
  console.log("Migration finished.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
