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
 * Optional Storage → Spaces:
 *   DO_SPACES_ENDPOINT, DO_SPACES_KEY, DO_SPACES_SECRET, DO_SPACES_BUCKET
 *   SKIP_SPACES_UPLOAD=1                     — omit Firebase Storage → Spaces step
 *   MIGRATE_REWRITE_DOWNLOAD_URL=true        — naive string rewrite in stored JSON (risky); default false.
 *
 * TLS (DigitalOcean Postgres — if you see SELF_SIGNED_CERT_IN_CHAIN):
 *   DATABASE_SSL_CA_PATH=./ca-certificate.crt   — CA from DB connection page (recommended)
 *   DATABASE_SSL_REJECT_UNAUTHORIZED=false    — migration-only; skips cert verify
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Pool } = require("pg");
const { poolOptions } = require("../lib/pgPoolOptions.cjs");
const admin = require("firebase-admin");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

function loadServiceAccount() {
  const literal = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (literal) return JSON.parse(literal);

  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!p) throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS");
  const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function coerceJsonValue(v, seen = new WeakMap()) {
  if (v == null) return v;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString();
  if (v.toDate && typeof v.toDate === "function") return v.toDate().toISOString();

  /*
   * Firestore GeoPoint etc. skipped
   */
  if (v.constructor && v.constructor.name === "Timestamp" && typeof v.seconds === "number") {
    return new Date(v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6)).toISOString();
  }

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

async function migrateCollection(collRef, pool) {
  const snap = await collRef.get();

  /*
   * collection path for top-level refs
   */


  /*
   * documents stored at full path ids
   */


  /*
   */ // eslint stylistic silence

  for (const doc of snap.docs) {
    const fp = doc.ref.path;
    const data = coerceJsonValue(doc.data() || {});
    await pool.query(
      `
      INSERT INTO documents(path, data, created_at, updated_at)
      VALUES ($1,$2::jsonb, now(), now())
      ON CONFLICT (path)
      DO UPDATE SET data=$2::jsonb, updated_at=now()
    `,
      [fp, JSON.stringify(data)]
    );

    const subs = await doc.ref.listCollections();
    for (const sub of subs) {
      await migrateCollection(sub, pool);
    }
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

  const roots = await db.listCollections();

  /*
   * Top-level migrations
   */
  for (const col of roots) {
    console.log("collection", col.id);
    await migrateCollection(col, pool);
  }

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
