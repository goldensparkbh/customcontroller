/** HTTP API helpers (DigitalOcean / self-hosted Postgres backend). */

export function serverTs() {
  return new Date().toISOString();
}

async function readError(res) {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return res.statusText;
  }
}

async function adminFetch(path, opts = {}) {
  const {
    body: incomingBody,
    headers: hdr = {},
    credentials = "include",
    method,
    redirect,
    referrer,
    signal,
    referrerPolicy,
    duplex,
    keepalive,
    mode,
    integrity
  } = opts;

  let body = incomingBody;

  /** @type {Record<string,string>} */
  const headers = { ...hdr };

  if (incomingBody != null && !(incomingBody instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    body =
      typeof incomingBody === "string" ?
        incomingBody :
        JSON.stringify(incomingBody);
  }

  /** @type {RequestInit & { duplex?: typeof duplex }} */
  const init = {
    method,
    credentials,
    headers,
    redirect,
    referrer,
    signal,
    referrerPolicy,
    keepalive,
    mode,
    integrity,
    ...(body !== undefined ? { body } : {})
  };

  /*
   * `duplex` is only meaningful for streaming uploads; propagate when callers use it explicitly.
   */
  if (typeof duplex !== "undefined") Object.assign(init, { duplex });

  const res = await fetch(path, init);

  if (!res.ok) {
    throw new Error((await readError(res)) || `${res.status}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

/* -------------------------------------------------------------------------- */

export async function fetchConfiguratorCatalog() {
  const res = await fetch("/store-api/configurator/catalog");
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchI18nOverrideEntries() {
  const res = await fetch("/store-api/i18n/overrides");
  if (!res.ok) throw new Error(await readError(res));
  const j = await res.json();
  return j.entries && typeof j.entries === "object" ? j.entries : {};
}

export async function fetchSiteStatus() {
  const res = await fetch("/store-api/site/status");
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchExchangeRates() {
  const res = await fetch("/store-api/exchange-rates");
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchGeoCurrency() {
  const res = await fetch("/store-api/geo/currency");
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchPosCatalog() {
  const res = await fetch("/store-api/pos/catalog");
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function createPosOrder(orderPayload) {
  const res = await fetch("/store-api/pos/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderPayload)
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/* -------------------------------------------------------------------------- */

export async function adminLogin(email, password) {
  return adminFetch("/admin-api/auth/login", { method: "POST", body: { email, password } });
}

export async function adminLogout() {
  return adminFetch("/admin-api/auth/logout", { method: "POST", body: {} });
}

export async function adminMe() {
  try {
    return await adminFetch("/admin-api/auth/me", { method: "GET" });
  } catch {
    return null;
  }
}

export async function adminListDocs(prefix, orderBy) {
  const q = new URLSearchParams({ prefix });
  if (orderBy) q.set("orderBy", orderBy);
  return adminFetch(`/admin-api/docs?${q}`, { method: "GET" });
}

export async function adminGetDoc(docPath) {
  const q = new URLSearchParams({ path: docPath });
  return adminFetch(`/admin-api/doc?${q}`, { method: "GET" });
}

export async function adminPatchDoc(docPath, patch) {
  const q = new URLSearchParams({ path: docPath });
  return adminFetch(`/admin-api/doc?${q}`, { method: "PATCH", body: patch });
}

export async function adminPutDocData(docPath, data) {
  const q = new URLSearchParams({ path: docPath });
  return adminFetch(`/admin-api/doc?${q}`, { method: "PUT", body: { data } });
}

export async function adminCreateDoc(body) {
  return adminFetch("/admin-api/doc", { method: "POST", body });
}

export async function adminDeleteDoc(docPath) {
  const q = new URLSearchParams({ path: docPath });
  return adminFetch(`/admin-api/doc?${q}`, { method: "DELETE" });
}

export async function adminBatch(body) {
  return adminFetch("/admin-api/batch", { method: "POST", body });
}

export async function adminAllocateCounter(counterKey, startAt) {
  return adminFetch("/admin-api/counter/next", { method: "POST", body: { counterKey, startAt } });
}

/**
 * @param {File|Blob} file
 * @param {{ imageProfile?: 'configurator_icon' | 'configurator_overlay' | 'default' }} [opts]
 */
export async function adminUploadFile(file, opts = {}) {
  const fd = new FormData();
  fd.append("file", file);
  if (opts.imageProfile) {
    fd.append("imageProfile", opts.imageProfile);
  }
  return adminFetch("/admin-api/upload", { method: "POST", body: fd });
}
