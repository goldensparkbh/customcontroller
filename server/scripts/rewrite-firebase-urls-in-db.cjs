"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

/*
 * One-time (idempotent) migration: rewrite legacy Firebase Storage URLs and
 * normalize incorrect Spaces origin/CDN URLs embedded in Postgres documents.
 *
 * This bakes the same transform the server does at read-time
 * (`rewriteFirebaseMediaUrlsIfConfigured`) into the stored JSON, so the data no
 * longer depends on the runtime rewrite.
 *
 * Prereqs (same as the running server / upload endpoint):
 *   DATABASE_URL                 — Postgres connection string
 *   DO_SPACES_BUCKET             — Spaces bucket (e.g. customcontroller)
 *   one of:
 *     DO_SPACES_PUBLIC_BASE_URL  — e.g. https://bucket.fra1.digitaloceanspaces.com
 *     DO_SPACES_CDN_BASE_URL     — e.g. https://bucket.fra1.cdn.digitaloceanspaces.com
 *     DO_SPACES_ENDPOINT         — e.g. https://bucket.fra1.digitaloceanspaces.com
 *   DO_SPACES_KEY_PREFIX / DO_SPACES_LEGACY_MIGRATE_PREFIX — migrated files prefix (default: migrated)
 *
 * Usage (from repo root):
 *   node server/scripts/rewrite-firebase-urls-in-db.cjs            # dry-run (no writes)
 *   node server/scripts/rewrite-firebase-urls-in-db.cjs --apply    # write changes
 *   node server/scripts/rewrite-firebase-urls-in-db.cjs --limit=5  # inspect a few docs
 *   node server/scripts/rewrite-firebase-urls-in-db.cjs --apply --verify  # + HEAD-check targets
 *
 * This project defaults to:
 *   https://customcontroller.fra1.cdn.digitaloceanspaces.com/customcontroller/migrated/...
 */

const { Pool } = require("pg");
const { poolOptions } = require("../lib/pgPoolOptions.cjs");
const {
  rewriteFirebaseMediaUrlsIfConfigured,
  hasSpacesPublicTarget
} = require("../lib/assetUrlRewrite.cjs");

const APPLY = process.argv.includes("--apply");
const VERIFY = process.argv.includes("--verify");
const LIMIT = (() => {
  const raw = process.argv.find((a) => a.startsWith("--limit="));
  if (!raw) return null;
  const n = Number(raw.split("=")[1]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
})();

function collectFirebaseUrls(value, out) {
  if (typeof value === "string") {
    if (value.includes("firebasestorage.googleapis.com")) out.add(value);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((v) => collectFirebaseUrls(v, out));
    return;
  }
  for (const v of Object.values(value)) collectFirebaseUrls(v, out);
}

async function headOk(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");

  if (!hasSpacesPublicTarget(process.env)) {
    throw new Error(
      "No Spaces target configured. Set DO_SPACES_BUCKET plus one of " +
        "DO_SPACES_PUBLIC_BASE_URL / DO_SPACES_CDN_BASE_URL / DO_SPACES_ENDPOINT."
    );
  }

  const rawFlag = String(process.env.REWRITE_FIREBASE_MEDIA_URLS || "").trim().toLowerCase();
  if (rawFlag === "false" || rawFlag === "0" || rawFlag === "no") {
    throw new Error("REWRITE_FIREBASE_MEDIA_URLS is disabled; unset it before running this migration.");
  }

  const pool = new Pool(poolOptions(process.env.DATABASE_URL));
  const stats = { scanned: 0, changed: 0, urlsRewritten: 0, verifyMissing: 0 };
  const missingTargets = new Set();
  let transactionStarted = false;

  try {
    const { rows } = await pool.query(
      `SELECT path, data
         FROM documents
        WHERE data::text LIKE '%firebasestorage.googleapis.com%'
           OR data::text LIKE '%digitaloceanspaces.com%'
        ORDER BY path`
    );
    const targetRows = LIMIT ? rows.slice(0, LIMIT) : rows;
    if (APPLY) {
      await pool.query("BEGIN");
      transactionStarted = true;
    }
    console.log(
      `Found ${rows.length} document(s) containing Firebase URLs${LIMIT ? ` (processing first ${targetRows.length})` : ""}.`
    );
    console.log(APPLY ? "Mode: APPLY (writing changes)\n" : "Mode: DRY-RUN (no writes; pass --apply to write)\n");

    for (const row of targetRows) {
      stats.scanned += 1;
      const before = row.data || {};
      const after = rewriteFirebaseMediaUrlsIfConfigured(before);

      const beforeStr = JSON.stringify(before);
      const afterStr = JSON.stringify(after);
      if (beforeStr === afterStr) continue;

      const beforeUrls = new Set();
      const afterUrls = new Set();
      collectFirebaseUrls(before, beforeUrls);
      collectFirebaseUrls(after, afterUrls);
      const rewrittenCount = beforeUrls.size - afterUrls.size;

      stats.changed += 1;
      stats.urlsRewritten += Math.max(rewrittenCount, 0);

      if (afterUrls.size > 0) {
        console.warn(`  [warn] ${row.path}: ${afterUrls.size} Firebase URL(s) NOT rewritten (unrecognized format).`);
      }

      if (VERIFY) {
        const newUrls = [];
        const collectNew = (v) => {
          if (typeof v === "string") {
            if (v.includes("digitaloceanspaces.com")) newUrls.push(v);
            return;
          }
          if (!v || typeof v !== "object") return;
          if (Array.isArray(v)) return v.forEach(collectNew);
          Object.values(v).forEach(collectNew);
        };
        collectNew(after);
        for (const u of newUrls) {
          if (!missingTargets.has(u) && !(await headOk(u))) {
            missingTargets.add(u);
            stats.verifyMissing += 1;
            console.warn(`  [verify] missing object: ${u}`);
          }
        }
      }

      if (LIMIT) {
        console.log(`  ~ ${row.path}: normalized asset URLs`);
      }

      if (APPLY) {
        await pool.query("UPDATE documents SET data=$2::jsonb, updated_at=now() WHERE path=$1", [
          row.path,
          afterStr
        ]);
      }
    }

    if (transactionStarted) {
      await pool.query("COMMIT");
      transactionStarted = false;
    }

    console.log("\n--- Summary ---");
    console.log(`  Documents scanned:        ${stats.scanned}`);
    console.log(`  Documents changed:        ${stats.changed}`);
    console.log(`  Firebase URLs rewritten:  ${stats.urlsRewritten}`);
    if (VERIFY) console.log(`  Missing target objects:   ${stats.verifyMissing}`);
    if (!APPLY) console.log("\nDry-run only. Re-run with --apply to persist.");
    else console.log("\nChanges written.");
  } catch (error) {
    if (transactionStarted) {
      await pool.query("ROLLBACK");
      transactionStarted = false;
    }
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
