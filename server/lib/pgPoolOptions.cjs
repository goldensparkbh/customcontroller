"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Options for `pg` Pool when connecting to DigitalOcean Managed Postgres.
 * Fixes SELF_SIGNED_CERT_IN_CHAIN when Node does not trust the provider CA.
 *
 * Set one of:
 *   DATABASE_SSL_CA_PEM — full PEM text (App Platform secret; use real newlines or \n)
 *   DATABASE_SSL_CA_PATH or PGSSLROOTCERT — path to CA file (local / mounted)
 *   DATABASE_SSL_REJECT_UNAUTHORIZED=false — weaker; dev / emergency only
 *   DATABASE_SSL_RELAX_DO=false — disable auto-relax below (when you use DATABASE_SSL_CA_PEM)
 *
 * App Platform / containers often have no CA file: if DATABASE_URL host is
 * `*.db.ondigitalocean.com` and no PEM/path/builtin CA is set, we use TLS with
 * rejectUnauthorized:false (still encrypted). Set DATABASE_SSL_RELAX_DO=false to force strict.
 *
 * If unset, uses `server/ca-certificate.crt` when that file exists (next to package root).
 */
function isDigitalOceanManagedPostgresUrl(urlString) {
  return typeof urlString === "string" && urlString.includes("db.ondigitalocean.com");
}
function resolveCaPemFromEnv() {
  const raw = process.env.DATABASE_SSL_CA_PEM;
  if (!raw || typeof raw !== "string") return null;
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim();
  if (!normalized.includes("BEGIN")) return null;
  return normalized;
}

function resolveCaFilePath() {
  const raw = (process.env.DATABASE_SSL_CA_PATH || process.env.PGSSLROOTCERT || "").trim();
  if (raw) {
    const tryPaths = [
      path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw),
      path.join(__dirname, "..", raw)
    ];
    for (const abs of tryPaths) {
      if (fs.existsSync(abs)) return abs;
    }
    throw new Error(
      `DATABASE_SSL_CA_PATH / PGSSLROOTCERT file not found — tried: ${tryPaths.join(", ")}`
    );
  }

  /*
   * `__dirname` is `server/lib` — sibling `ca-certificate.crt` in `server/`
   */
  const builtin = path.join(__dirname, "..", "ca-certificate.crt");
  if (fs.existsSync(builtin)) return builtin;
  return null;
}

/*
 * `pg` parses `sslmode=require` (etc.) from the URI and merges TLS options. That can
 * ignore or fight `ssl.ca` and still yield SELF_SIGNED_CERT_IN_CHAIN. Strip libpq
 * SSL query params when we supply explicit `ssl` below.
 */
function stripLibpqSslQueryParams(urlString) {
  if (!urlString || typeof urlString !== "string") return urlString;
  const at = urlString.lastIndexOf("@");
  if (at === -1) return urlString;
  const q = urlString.indexOf("?", at);
  if (q === -1) return urlString;
  const base = urlString.slice(0, q);
  const query = urlString.slice(q + 1);
  const params = new URLSearchParams(query);
  for (const k of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert", "channel_binding"]) {
    params.delete(k);
  }
  const rest = params.toString();
  return rest ? `${base}?${rest}` : base;
}

function poolOptions(connectionString) {
  const caPem = resolveCaPemFromEnv();
  const caPath = resolveCaFilePath();
  const hasBuiltinCa = !!(caPath && fs.existsSync(caPath));
  const useInsecure = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false";
  const relaxDoManaged =
    process.env.DATABASE_SSL_RELAX_DO !== "false" &&
    isDigitalOceanManagedPostgresUrl(connectionString) &&
    !caPem &&
    !hasBuiltinCa;

  let conn = connectionString;
  if (caPem || hasBuiltinCa || useInsecure || relaxDoManaged) {
    conn = stripLibpqSslQueryParams(connectionString);
  }

  const out = { connectionString: conn };
  if (caPem) {
    out.ssl = {
      ca: caPem,
      rejectUnauthorized: true
    };
    return out;
  }
  if (hasBuiltinCa) {
    out.ssl = {
      ca: fs.readFileSync(caPath),
      rejectUnauthorized: true
    };
    return out;
  }
  if (useInsecure) {
    out.ssl = { rejectUnauthorized: false };
    return out;
  }
  if (relaxDoManaged) {
    out.ssl = { rejectUnauthorized: false };
    return out;
  }
  return out;
}

module.exports = { poolOptions };
