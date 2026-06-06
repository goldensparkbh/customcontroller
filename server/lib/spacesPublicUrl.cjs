"use strict";

/**
 * Build browser-accessible DigitalOcean Spaces URLs.
 *
 * With CDN enabled, public objects are served at:
 *   https://{bucket}.{region}.cdn.digitaloceanspaces.com/{bucket}/{key}
 *
 * Origin virtual-host URLs (without /{bucket}/ in the path) often return AccessDenied
 * when CDN is enabled on the Space.
 *
 * Env:
 *   DO_SPACES_BUCKET
 *   DO_SPACES_PUBLIC_BASE_URL — optional; origin or CDN base (with or without /{bucket})
 *   DO_SPACES_CDN_BASE_URL    — optional override for CDN base (e.g. https://bucket.fra1.cdn.digitaloceanspaces.com)
 *   DO_SPACES_ENDPOINT        — fallback when PUBLIC_BASE_URL is unset
 */

function normalizeObjectKey(key) {
  return String(key || "").replace(/^\/+/u, "");
}

function deriveCdnBaseWithBucket(originOrCdnBase, bucket) {
  const raw = String(originOrCdnBase || "").trim().replace(/\/+$/u, "");
  if (!raw || !bucket) return raw;

  if (raw.includes(".cdn.digitaloceanspaces.com")) {
    return raw.endsWith(`/${bucket}`) ? raw : `${raw}/${bucket}`;
  }

  const m = raw.match(/^https:\/\/([^.]+)\.([^.]+)\.digitaloceanspaces\.com$/u);
  if (!m) return raw;
  const [, bucketFromHost, region] = m;
  if (bucketFromHost !== bucket) return raw;
  return `https://${bucket}.${region}.cdn.digitaloceanspaces.com/${bucket}`;
}

/**
 * @param {string} objectKey — e.g. uploads/file.png or migrated/path/file.png
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
function buildSpacesPublicUrl(objectKey, env = process.env) {
  const bucket = String(env.DO_SPACES_BUCKET || "").trim();
  const key = normalizeObjectKey(objectKey);
  if (!key) return "";

  const cdnOverride = String(env.DO_SPACES_CDN_BASE_URL || "").trim().replace(/\/+$/u, "");
  const publicBase = String(env.DO_SPACES_PUBLIC_BASE_URL || "").trim().replace(/\/+$/u, "");
  const endpoint = String(env.DO_SPACES_ENDPOINT || "").trim().replace(/\/+$/u, "");

  if (cdnOverride && bucket) {
    const base = cdnOverride.endsWith(`/${bucket}`) ? cdnOverride : `${cdnOverride}/${bucket}`;
    return `${base}/${key}`;
  }

  if (publicBase) {
    const base = deriveCdnBaseWithBucket(publicBase, bucket);
    return `${base}/${key}`;
  }

  if (endpoint && bucket) {
    return deriveCdnBaseWithBucket(endpoint, bucket) + `/${key}`;
  }

  return key;
}

/**
 * Fix legacy/wrong Spaces URLs saved in documents (origin host, missing /{bucket}/ path).
 * @param {string} urlString
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
function normalizeSpacesPublicUrl(urlString, env = process.env) {
  if (!urlString || typeof urlString !== "string") return urlString;
  const trimmed = urlString.trim();
  if (!trimmed.includes("digitaloceanspaces.com")) return urlString;

  const bucket = String(env.DO_SPACES_BUCKET || "").trim();
  if (!bucket) return urlString;

  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname.includes("digitaloceanspaces.com")) return urlString;

    if (parsed.hostname.includes(".cdn.") && parsed.pathname.startsWith(`/${bucket}/`)) {
      return trimmed;
    }

    let key = parsed.pathname.replace(/^\/+/u, "");
    if (key.startsWith(`${bucket}/`)) {
      key = key.slice(bucket.length + 1);
    }
    if (!key) return urlString;

    const fixed = buildSpacesPublicUrl(key, env);
    return fixed || urlString;
  } catch {
    return urlString;
  }
}

module.exports = {
  buildSpacesPublicUrl,
  normalizeSpacesPublicUrl,
  deriveCdnBaseWithBucket
};
