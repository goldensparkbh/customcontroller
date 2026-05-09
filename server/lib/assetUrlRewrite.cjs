"use strict";

/**
 * Rewrite legacy Firebase Storage download URLs embedded in migrated JSON documents
 * to DigitalOcean Spaces (or any S3 public base) URLs.
 *
 * Migrate script uploads with Key = `{DO_SPACES_KEY_PREFIX}/{firebaseObjectName}` — use
 * the same prefix here (often `migrated`).
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
  const base = String(publicBaseUrl || "").trim().replace(/\/+$/u, "");
  const objectPath = String(firebaseObjectPath || "").replace(/^\/+/u, "");
  if (!base || !objectPath) return null;

  const prefixParts = migratedPrefixSegments
    .trim()
    .replace(/^\/+/u, "")
    .split("/")
    .filter(Boolean);
  const objectParts = objectPath.split("/").filter(Boolean);

  const encodedPath = [...prefixParts, ...objectParts].map((seg) => encodeURIComponent(seg)).join("/");
  return `${base}/${encodedPath}`;
}

function rewriteFirebaseUrlsInString(urlString, config) {
  if (!urlString || typeof urlString !== "string") return urlString;

  /*
   * Some fields join multiple URLs; split not supported — rewrite whole string only if it parses as firebase URL.
   */
  const objectPath = extractFirebaseStorageObjectPath(urlString.trim());
  if (!objectPath) return urlString;

  const next = buildSpacesPublicObjectUrl(config.publicBase, config.migratedPrefix, objectPath);
  return next || urlString;
}

function rewriteFirebaseMediaDeep(value, config) {
  if (!config || !config.publicBase || config.enabled === false) return value;

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
 * Applies env-based rewrite rules (PUBLIC_BASE_URL, prefix). No-op if disabled or unset.
 */
function rewriteFirebaseMediaUrlsIfConfigured(payload) {
  const publicBase = String(process.env.DO_SPACES_PUBLIC_BASE_URL || "").trim();
  const rawFlag = String(process.env.REWRITE_FIREBASE_MEDIA_URLS || "").trim().toLowerCase();

  /*
   * Off only when explicitly false; enable when PUBLIC_BASE_URL is present.
   */
  const explicitOff = rawFlag === "false" || rawFlag === "0" || rawFlag === "no";
  if (explicitOff || !publicBase) return payload;

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
  rewriteFirebaseMediaDeep
};
