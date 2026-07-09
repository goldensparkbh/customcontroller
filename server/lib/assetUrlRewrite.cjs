"use strict";

const { buildSpacesPublicUrl, normalizeSpacesPublicUrl } = require("./spacesPublicUrl.cjs");

/**
 * Rewrite legacy Firebase Storage download URLs embedded in migrated JSON documents
 * to DigitalOcean Spaces (or any S3 public base) URLs.
 *
 * Migrate script uploads with Key = `{DO_SPACES_KEY_PREFIX}/{firebaseObjectName}` — use
 * the same prefix here (often `migrated`).
 *
 * Also normalizes wrong origin Spaces URLs to CDN form:
 *   https://bucket.region.digitaloceanspaces.com/key
 *   -> https://bucket.region.cdn.digitaloceanspaces.com/bucket/key
 *
 * Env:
 *   DO_SPACES_PUBLIC_BASE_URL  — required to enable (e.g. https://bucket.fra1.digitaloceanspaces.com)
 *   DO_SPACES_KEY_PREFIX       — same as migration (default: migrated); alias DO_SPACES_LEGACY_MIGRATE_PREFIX
 *   REWRITE_FIREBASE_MEDIA_URLS — set `false` to disable (default when PUBLIC_BASE_URL set: on)
 */

function extractFirebaseStorageObjectPath(urlString) {
  if (!urlString || typeof urlString !== "string") return null;
  if (!urlString.includes("firebasestorage.googleapis.com")) return null;

  try {
    const parsed = new URL(urlString);
    /*
     * Typical: .../v0/b/{bucket}/o/{percentEncodedPath}?alt=media&...
     */
    const m = parsed.pathname.match(/^\/v0\/b\/[^/]+\/o\/(.+)$/u);
    if (!m || !m[1]) return null;
    const encoded = m[1];
    return decodeURIComponent(encoded.replace(/\+/gu, "%20"));
  } catch {
    return null;
  }
}

function buildSpacesPublicObjectUrl(publicBaseUrl, migratedPrefixSegments, firebaseObjectPath) {
  const objectPath = String(firebaseObjectPath || "").replace(/^\/+/u, "");
  if (!objectPath) return null;

  const prefixParts = migratedPrefixSegments
    .trim()
    .replace(/^\/+/u, "")
    .split("/")
    .filter(Boolean);
  const objectParts = objectPath.split("/").filter(Boolean);
  const key = [...prefixParts, ...objectParts].join("/");

  return buildSpacesPublicUrl(key, {
    ...process.env,
    DO_SPACES_PUBLIC_BASE_URL: String(publicBaseUrl || process.env.DO_SPACES_PUBLIC_BASE_URL || "").trim()
  });
}

function rewriteFirebaseUrlsInString(urlString, config) {
  if (!urlString || typeof urlString !== "string") return urlString;

  const trimmed = urlString.trim();

  /*
   * Some fields join multiple URLs; split not supported — rewrite whole string only if it parses as firebase URL.
   */
  const objectPath = extractFirebaseStorageObjectPath(trimmed);
  if (objectPath) {
    const next = buildSpacesPublicObjectUrl(config.publicBase, config.migratedPrefix, objectPath);
    return next || urlString;
  }

  if (trimmed.includes("digitaloceanspaces.com")) {
    return normalizeSpacesPublicUrl(trimmed, process.env);
  }

  return urlString;
}

function rewriteFirebaseMediaDeep(value, config) {
  if (!config || config.enabled === false) return value;

  if (typeof value === "string") return rewriteFirebaseUrlsInString(value, config);

  if (!value || typeof value !== "object") return value;

  if (Array.isArray(value)) return value.map((v) => rewriteFirebaseMediaDeep(v, config));

  const out = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = rewriteFirebaseMediaDeep(inner, config);
  }
  return out;
}

/*
 * True when Spaces is configured enough for `buildSpacesPublicUrl` to produce a
 * full public URL. Mirrors the fallbacks in spacesPublicUrl.cjs so the rewrite
 * activates on the same config that makes the /upload endpoint work — even when
 * DO_SPACES_PUBLIC_BASE_URL is absent (only endpoint/CDN + bucket are set).
 */
function hasSpacesPublicTarget(env) {
  const bucket = String(env.DO_SPACES_BUCKET || "").trim();
  const publicBase = String(env.DO_SPACES_PUBLIC_BASE_URL || "").trim();
  const cdnBase = String(env.DO_SPACES_CDN_BASE_URL || "").trim();
  const endpoint = String(env.DO_SPACES_ENDPOINT || "").trim();

  if (publicBase) return true;
  if (cdnBase && bucket) return true;
  if (endpoint && bucket) return true;
  return false;
}

/*
 * Applies env-based rewrite rules (Spaces target + prefix). No-op if disabled or unset.
 */
function rewriteFirebaseMediaUrlsIfConfigured(payload) {
  const rawFlag = String(process.env.REWRITE_FIREBASE_MEDIA_URLS || "").trim().toLowerCase();

  /*
   * Off only when explicitly false; otherwise enable whenever any Spaces public
   * target is configured (consistent with the upload URL builder).
   */
  const explicitOff = rawFlag === "false" || rawFlag === "0" || rawFlag === "no";
  if (explicitOff || !hasSpacesPublicTarget(process.env)) return payload;

  const publicBase = String(process.env.DO_SPACES_PUBLIC_BASE_URL || "").trim();
  const migratedPrefix =
    String(process.env.DO_SPACES_LEGACY_MIGRATE_PREFIX || process.env.DO_SPACES_KEY_PREFIX || "migrated").trim();

  return rewriteFirebaseMediaDeep(payload, {
    publicBase,
    migratedPrefix,
    enabled: true
  });
}

module.exports = {
  rewriteFirebaseMediaUrlsIfConfigured,
  extractFirebaseStorageObjectPath,
  buildSpacesPublicObjectUrl,
  rewriteFirebaseMediaDeep,
  hasSpacesPublicTarget
};
