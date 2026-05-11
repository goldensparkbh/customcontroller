"use strict";

const sharp = require("sharp");

const RASTER_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/tiff",
  "image/avif"
]);

/** Longest edge caps — icons are tiny in UI; overlays need detail but not 8K sources. */
const PROFILES = {
  configurator_icon: { maxEdge: 360, quality: 80 },
  configurator_overlay: { maxEdge: 1536, quality: 84 },
  default: { maxEdge: 2048, quality: 85 }
};

/**
 * @param {Buffer} buffer
 * @param {string} mime
 * @param {string} profile
 * @returns {Promise<{ buffer: Buffer, contentType: string, ext: string } | null>}
 */
async function maybeOptimizeRasterUpload(buffer, mime, profile) {
  const flag = String(process.env.UPLOAD_IMAGE_OPTIMIZE || "true").trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") {
    return null;
  }
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 32) {
    return null;
  }

  const mimeNorm = String(mime || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!RASTER_MIME.has(mimeNorm)) {
    return null;
  }

  const spec = PROFILES[profile] || PROFILES.default;

  try {
    const pipeline = sharp(buffer, { failOn: "none", animated: false }).rotate();

    const out = await pipeline
      .resize({
        width: spec.maxEdge,
        height: spec.maxEdge,
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({
        quality: spec.quality,
        alphaQuality: Math.min(100, spec.quality + 4),
        effort: 4
      })
      .toBuffer();

    if (!out || out.length === 0) {
      return null;
    }
    if (out.length >= buffer.length * 0.98 && mimeNorm === "image/webp") {
      return null;
    }

    return { buffer: out, contentType: "image/webp", ext: ".webp" };
  } catch {
    return null;
  }
}

module.exports = { maybeOptimizeRasterUpload, PROFILES };
