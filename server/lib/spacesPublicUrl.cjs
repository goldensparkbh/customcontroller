"use strict";

/**
 * Build browser-accessible DigitalOcean Spaces URLs.
 *
 * Virtual-hosted origin and CDN URLs both identify the Space in the hostname:
 *   https://{bucket}.{region}.digitaloceanspaces.com/{key}
 *   https://{bucket}.{region}.cdn.digitaloceanspaces.com/{key}
 *
 * A region-only S3 endpoint uses path style instead:
 *   https://{region}.digitaloceanspaces.com/{bucket}/{key}
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

function encodeObjectKey(key) {
  return normalizeObjectKey(key)
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function deriveCdnBaseWithBucket(originOrCdnBase, bucket) {
  const raw = String(originOrCdnBase || "").trim().replace(/\/+$/u, "");
  if (!raw || !bucket) return raw;

  try {
    const parsed = new URL(raw);
    const labels = parsed.hostname.toLowerCase().split(".");
    const isSpacesHost = parsed.hostname.toLowerCase().endsWith(".digitaloceanspaces.com");
    const isRegionOnlyHost = isSpacesHost && labels.length === 3;
    const path = parsed.pathname.replace(/\/+$/u, "");

    if (isRegionOnlyHost && path !== `/${bucket}` && !path.startsWith(`/${bucket}/`)) {
      parsed.pathname = `${path}/${bucket}`;
    }

    return parsed.toString().replace(/\/+$/u, "");
  } catch {
    return raw;
  }
}

/**
 * @param {string} objectKey — e.g. uploads/file.png or migrated/path/file.png
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
function buildSpacesPublicUrl(objectKey, env = process.env) {
  const bucket = String(env.DO_SPACES_BUCKET || "").trim();
  const key = encodeObjectKey(objectKey);
  if (!key) return "";

  const cdnOverride = String(env.DO_SPACES_CDN_BASE_URL || "").trim().replace(/\/+$/u, "");
  const publicBase = String(env.DO_SPACES_PUBLIC_BASE_URL || "").trim().replace(/\/+$/u, "");
  const endpoint = String(env.DO_SPACES_ENDPOINT || "").trim().replace(/\/+$/u, "");

  if (cdnOverride) {
    const base = deriveCdnBaseWithBucket(cdnOverride, bucket);
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

    let key = parsed.pathname.replace(/^\/+/u, "");
    const virtualHosted = parsed.hostname.startsWith(`${bucket}.`);
    if (virtualHosted && key.startsWith(`${bucket}/`)) {
      key = key.slice(bucket.length + 1);
    }
    if (!key) return urlString;

    /*
     * Rebuild against the configured public target so legacy origin URLs and
     * accidentally bucket-prefixed virtual-host URLs are normalized consistently.
     */
    return buildSpacesPublicUrl(decodeURIComponent(key), env) || urlString;
  } catch {
    return urlString;
  }
}

module.exports = {
  buildSpacesPublicUrl,
  normalizeSpacesPublicUrl,
  deriveCdnBaseWithBucket,
  encodeObjectKey
};
