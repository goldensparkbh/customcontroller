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
 *   MIGRATE_REWRITE_DOWNLOAD_URL=true        — naive string rewrite in stored JSON (risky); default false.
 */

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
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

  admin.initializeApp({
    credential: admin.credential.cert(loadServiceAccount())
  });

  const db = admin.firestore();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const roots = await db.listCollections();

  /*
   * Top-level migrations
   */
  for (const col of roots) {
    console.log("collection", col.id);
    await migrateCollection(col, pool);
  }

  /*
   * Optional storage copy
   */
  const Bucket = process.env.FIREBASE_STORAGE_BUCKET || undefined;
  if (Bucket && process.env.DO_SPACES_BUCKET) {
    const bucket = admin.storage().bucket(Bucket);
    const [files] = await bucket.getFiles();

    const s3 = new S3Client({
      region: "us-east-1",
      endpoint: process.env.DO_SPACES_ENDPOINT,
      credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET
      },
      forcePathStyle: process.env.DO_SPACES_FORCE_PATH_STYLE !== "false"
    });

    /*
     * Sequential to avoid blasting memory
     */
    for (const file of files) {
      /*
       * Skip directory placeholders
       */
      if (/\/$/u.test(file.name)) continue;

      const [buf] = await file.download();
      const Key = `${String(process.env.DO_SPACES_KEY_PREFIX || "migrated").replace(/\/+$/, "")}/${file.name.replace(/^\/+/u, "")}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.DO_SPACES_BUCKET,
          Key,
          Body: Buffer.from(buf),
          ContentType: file.metadata?.contentType || "application/octet-stream",
          ACL: process.env.DO_SPACES_PUBLIC_ACL || "public-read"
        })
      );

      /*
       * Optional URL rewrite omitted by default — run bespoke SQL UPDATE if URLs follow a predictable pattern.
       */
    }
  }

  await pool.end();
  console.log("Migration finished.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
