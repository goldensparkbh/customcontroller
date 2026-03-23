const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
admin.initializeApp();
const dotenv = require("dotenv");
const PDFDocument = require("pdfkit");
const SVGtoPDF = require("svg-to-pdfkit");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const sharp = require("sharp");
const { FormData: UndiciFormData, Blob: UndiciBlob } = require("undici");
const FormDataCtor = typeof FormData !== "undefined" ? FormData : UndiciFormData;
const BlobCtor = typeof Blob !== "undefined" ? Blob : UndiciBlob;

dotenv.config({ path: path.join(__dirname, ".env") });

const ZOHO_TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const ZOHO_BASE = "https://www.zohoapis.com";
const FUNCTION_REGION = "us-central1";
const PROJECT_ID = process.env.GCLOUD_PROJECT || "ps5-controller";
const PREVIEW_BASE_URL = `https://${FUNCTION_REGION}-${PROJECT_ID}.cloudfunctions.net/preview`;

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID || "";
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || "";
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN || "";
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID || "";

let cachedAccessToken = null;
let cachedExpiry = 0;
let cachedBaseControllerUri = null;
let cachedBaseControllerBuf = null;
let cachedSmallControllerBuf = null;
let cachedSmtpTransporter = null;
let cachedSmtpTransporterKey = "";
const NAMECHEAP_SMTP_HOST = "mail.privateemail.com";
const NAMECHEAP_SMTP_PORT_SSL = 465;
const NAMECHEAP_SMTP_PORT_STARTTLS = 587;
const emailAddressPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const maskCache = {};

function getBaseControllerDataUri() {
  if (cachedBaseControllerUri) return cachedBaseControllerUri;
  try {
    const pngPath = path.join(__dirname, "assets", "controller_mask.png");
    const buf = fs.readFileSync(pngPath);
    cachedBaseControllerUri = "data:image/png;base64," + buf.toString("base64");
  } catch {
    cachedBaseControllerUri = null;
  }
  return cachedBaseControllerUri;
}

function getBaseControllerBuffer() {
  if (cachedBaseControllerBuf) return cachedBaseControllerBuf;
  try {
    const pngPath = path.join(__dirname, "assets", "controller_mask.png");
    cachedBaseControllerBuf = fs.readFileSync(pngPath);
  } catch {
    cachedBaseControllerBuf = null;
  }
  return cachedBaseControllerBuf;
}

function getMaskDataUri(partId) {
  if (maskCache[partId]) return maskCache[partId];
  const fileMap = {
    shell: "leftShell.png",
    trimpiece: "centerBody.png",
    stickL: "stickL.png",
    stickR: "stickR.png",
    faceButtons: "faceButtons.png",
    touchpad: "touchpad.png",
    bumpers: "bumperL.png",
    psButton: "psButton.png",
    share: "share.png",
    options: "options.png",
    backShellMain: "backShellMain.png",
    backTriggers: "backTriggers.png",
  };
  const file = fileMap[partId];
  if (!file) return null;
  try {
    const p = path.join(__dirname, "assets", "masks", file);
    const buf = fs.readFileSync(p);
    const uri = "data:image/png;base64," + buf.toString("base64");
    maskCache[partId] = uri;
    return uri;
  } catch {
    maskCache[partId] = null;
    return null;
  }
}

function sendImageValueResponse(res, data) {
  if (!data || typeof data !== "string") {
    return res.status(400).send("Missing image data");
  }
  if (data.startsWith("data:image/svg+xml")) {
    const base64 = data.split(",")[1] || "";
    const buf = Buffer.from(base64, "base64");
    res.setHeader("Content-Type", "image/svg+xml");
    return res.send(buf);
  }
  if (data.startsWith("data:image/")) {
    const meta = data.slice(5, data.indexOf(";"));
    const base64 = data.split(",")[1] || "";
    const buf = Buffer.from(base64, "base64");
    res.setHeader("Content-Type", meta);
    return res.send(buf);
  }
  if (/^https?:\/\//i.test(data)) {
    return res.redirect(data);
  }
  return res.status(400).send("Unsupported image format");
}

function getInitialOrderStatus(paymentStatus) {
  return paymentStatus === "Paid" ? "Paid" : "On Going";
}

function buildControllerSvg(config) {
  const entries = Object.entries(config || {}).filter(([, val]) => val);
  if (!entries.length) return null;
  const width = 1166;
  const height = 768;
  const baseHref = getBaseControllerDataUri();
  const overlays = [];
  entries.forEach(([, value]) => {
    const imageHref =
      (value && typeof value === "object" && (value.image || value.preview || value.url)) ||
      (typeof value === "string" && value.startsWith("data:image/") ? value : null);
    if (!imageHref) return;
    overlays.push(
      `<image href="${imageHref}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" />`
    );
  });
  if (!overlays.length) return null;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#0b0b0f">
  ${baseHref ? `<image href="${baseHref}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" opacity="0.98" />` : ""}
  ${overlays.join("\n")}
</svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

function ensureConfig() {
  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN || !ZOHO_ORG_ID) {
    throw new Error("Missing Zoho config. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ORG_ID in functions/.env");
  }
}

async function refreshAccessToken() {
  ensureConfig();
  const params = new URLSearchParams({
    refresh_token: ZOHO_REFRESH_TOKEN,
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });
  const res = await fetch(ZOHO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoho refresh failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  if (!json.access_token) throw new Error("Zoho refresh response missing access_token");
  cachedAccessToken = json.access_token;
  const expiresIn = Number(json.expires_in_sec || json.expires_in || 0);
  cachedExpiry = Date.now() + expiresIn * 1000 - 60_000; // refresh 1 min early
  return cachedAccessToken;
}

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < cachedExpiry) return cachedAccessToken;
  return refreshAccessToken();
}

async function fetchZohoJson(url, options, label) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  if (!res.ok) {
    console.error("[orderHandler] Zoho", label || "", "status", res.status, text);
  } else {
    console.log("[orderHandler] Zoho", label || "", "status", res.status, json && json.code ? json.code : "ok");
  }
  return json;
}

exports.zohoProxy = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    ensureConfig();
    let path = req.path || "/";
    if (path.startsWith("/zoho")) path = path.replace(/^\/zoho/, "");
    if (path.startsWith("/api/")) path = path.replace(/^\/api\//, "/inventory/");
    if (!path.startsWith("/inventory/")) {
      path = "/inventory" + (path.startsWith("/") ? path : "/" + path);
    }
    const urlObj = new URL(ZOHO_BASE + path);
    // Merge existing query parameters from the request
    Object.entries(req.query).forEach(([key, val]) => {
      urlObj.searchParams.set(key, String(val));
    });

    if (!urlObj.searchParams.has("organization_id")) {
      urlObj.searchParams.set("organization_id", ZOHO_ORG_ID);
    }

    const attempt = async (retry) => {
      const token = await getAccessToken();
      const hopByHop = new Set([
        "connection",
        "proxy-connection",
        "keep-alive",
        "te",
        "transfer-encoding",
        "upgrade",
        "host",
      ]);
      const headers = {};
      Object.entries(req.headers).forEach(([k, v]) => {
        const lower = k.toLowerCase();
        if (hopByHop.has(lower)) return;
        if (lower === "content-length") return;
        headers[k] = v;
      });
      headers.authorization = `Zoho-oauthtoken ${token}`;

      const forwardRes = await fetch(urlObj.toString(), {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : req.rawBody,
      });

      if (forwardRes.status === 401 && retry) {
        await refreshAccessToken();
        return attempt(false);
      }

      const contentType = forwardRes.headers.get("content-type") || "";
      res.status(forwardRes.status);
      forwardRes.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (["content-encoding", "transfer-encoding", "content-length", "connection"].includes(lower)) return;
        res.setHeader(key, value);
      });

      if (contentType.includes("application/json")) {
        const data = await forwardRes.json();
        res.json(data);
      } else {
        const buf = Buffer.from(await forwardRes.arrayBuffer());
        res.send(buf);
      }
    };

    await attempt(true);
  } catch (err) {
    console.error("[zohoProxy] error", err);
    res.status(500).json({ error: "zoho-proxy-error", detail: err.message });
  }
});

function buildAddress(customer) {
  const name = (customer.name || customer.fullName || "PS5 Customer").slice(0, 30);
  const address = "N/A"; // minimize to avoid Zoho length issues
  return {
    attention: name,
    address,
  };
}

function splitName(name) {
  if (!name) return { first: "PS5", last: "Customer" };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  const first = parts.shift();
  const last = parts.join(" ");
  return { first, last };
}

function formatCustomizations(config) {
  if (!config || typeof config !== "object") return "";
  const labels = {
    shell: "Shell",
    trimpiece: "Trim Piece",
    stickL: "Left stick",
    stickR: "Right stick",
    faceButtons: "Face buttons",
    touchpad: "Touchpad",
    bumpers: "Bumpers",
    psButton: "PS Button",
    share: "Share Button",
    options: "Options Button",
    backShellMain: "Back shell",
    backTriggers: "Back triggers"
  };
  const entries = Object.entries(config).filter(([, val]) => val);
  if (!entries.length) return "";
  const parts = entries.map(([key, val]) => `${labels[key] || key}: ${val}`);
  return "Customizations: " + parts.join(", ");
}

function listCustomizations(config) {
  if (!config || typeof config !== "object") return [];
  const labels = {
    shell: "Shell",
    trimpiece: "Trim Piece",
    stickL: "Left stick",
    stickR: "Right stick",
    faceButtons: "Face buttons",
    touchpad: "Touchpad",
    bumpers: "Bumpers",
    psButton: "PS Button",
    share: "Share Button",
    options: "Options Button",
    backShellMain: "Back shell",
    backTriggers: "Back triggers"
  };
  return Object.entries(config)
    .filter(([, val]) => val)
    .map(([k, v]) => `${labels[k] || k}: ${v}`);
}

function inlineSvgImages(svgStr) {
  const baseCtrl = getBaseControllerDataUri();
  if (!baseCtrl) return svgStr;
  return svgStr.replace(/href="[^"]*controller\.png[^"]*"/g, `href="${baseCtrl}"`);
}

function getItemImage(item) {
  // Try common fields for a rendered controller preview
  return (
    item.previewFront ||
    item.image ||
    item.preview || // new svg preview from cart
    item.thumbnail ||
    item.imageUrl ||
    item.imgUrl ||
    null
  );
}

async function buildCustomizationPdf(cart) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ autoFirstPage: true, margin: 36 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    function dataUriToBuffer(uri) {
      const base64 = uri.split(",")[1] || "";
      return Buffer.from(base64, "base64");
    }

    const cartItems = Array.isArray(cart) ? cart : [];
    cartItems.forEach((item, idx) => {
      if (idx > 0) doc.addPage();
      const pageW = doc.page.width;
      const pageH = doc.page.height;

      // background and container
      doc.save();
      doc.rect(0, 0, pageW, pageH).fill("#0b0b0f");
      doc.restore();
      doc.save();
      doc.rect(20, 60, pageW - 40, pageH - 120).fill("#11141b");
      doc.restore();

      const name = item.name || "PS5 Controller";
      const qty = item.quantity || 1;
      const lineTotal = item.unitPrice ? (item.unitPrice * qty).toFixed(2) : "";

      doc.fillColor("#fff").fontSize(16).text(name, 32, 78);
      doc.fillColor("#9ef56e").fontSize(11).text("Qty: " + qty, { continued: true }).text("    " + (lineTotal ? "Line: " + lineTotal : ""));

      // image area: build a tinted SVG from config; if none, use preview; else base
      const imgWidth = 160;
      const imgHeight = 105; // keeps controller aspect ratio (thumbnail size)
      const imgX = (pageW - imgWidth) / 2;
      const imgY = 170;
      let drewPreview = false;
      const configSvg = buildControllerSvg(item.config);
      if (configSvg) {
        try {
          const svgStr = Buffer.from(configSvg.split(",")[1] || "", "base64").toString("utf8");
          SVGtoPDF(doc, svgStr, imgX, imgY, { assumePt: true, width: imgWidth, height: imgHeight });
          drewPreview = true;
        } catch {
          // ignore
        }
      }
      if (!drewPreview) {
        const img = getItemImage(item);
        if (img && typeof img === "string" && img.startsWith("data:image/")) {
          try {
            if (img.startsWith("data:image/svg+xml")) {
              const base64 = img.split(",")[1] || "";
              let svgStr = Buffer.from(base64, "base64").toString("utf8");
              svgStr = inlineSvgImages(svgStr);
              SVGtoPDF(doc, svgStr, imgX, imgY, { assumePt: true, width: imgWidth, height: imgHeight });
              drewPreview = true;
            } else {
              const buf = dataUriToBuffer(img);
              doc.image(buf, imgX, imgY, { fit: [imgWidth, imgHeight], align: "center" });
              drewPreview = true;
            }
          } catch {
            // ignore overlay errors
          }
        }
      }
      if (!drewPreview) {
        const baseBuf = getBaseControllerBuffer();
        if (baseBuf) {
          try {
            doc.image(baseBuf, imgX, imgY, { fit: [imgWidth, imgHeight], align: "center", opacity: 0.98 });
          } catch {
            // ignore base image errors
          }
        }
      }

      // customizations list
      doc.fillColor("#fff").fontSize(12).text("Customization details:", 32, imgY + imgHeight + 20);
      const list = listCustomizations(item.config);
      if (!list.length) {
        doc.fillColor("#aaa").fontSize(11).text("No customizations", 32, imgY + imgHeight + 40);
      } else {
        let y = imgY + imgHeight + 40;
        list.forEach(str => {
          const parts = str.split(":");
          const label = parts[0] || "";
          const val = parts[1] || "";
          doc.circle(40, y + 5, 4).fill(val.trim() || "#7cfc00");
          doc.fillColor("#eaeaea").fontSize(11).text(label, 52, y - 4);
          doc.fillColor("#9ef56e").fontSize(10).text(val.trim(), 52, y + 10);
          y += 22;
        });
      }
    });

    doc.end();
  });
}

function getOrderLineTotal(item) {
  const qty = Number(item && item.quantity) > 0 ? Number(item.quantity) : 1;
  const unit = item && item.unitPrice != null ?
    Number(item.unitPrice) :
    (item && item.total != null ? Number(item.total) : 0);
  return (Number.isFinite(unit) ? unit : 0) * qty;
}

function getNormalizedOrderAmounts(body) {
  const items = Array.isArray(body && body.cart) ? body.cart : [];
  const subtotal = Number(body && body.subtotal) > 0 ?
    Number(body.subtotal) :
    items.reduce((sum, item) => sum + getOrderLineTotal(item), 0);
  const shippingCost = Number(body && body.shippingCost);
  const total = Number(body && body.total) > 0 ?
    Number(body.total) :
    subtotal + (Number.isFinite(shippingCost) && shippingCost > 0 ? shippingCost : 0);

  return {
    items,
    subtotal,
    shippingCost: Number.isFinite(shippingCost) ? shippingCost : 0,
    total
  };
}

function toFiniteNumber(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function createInventoryEntryId() {
  return `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeInventoryDate(value) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = raw ? new Date(raw) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function isLegacyInventoryRow(row = {}) {
  return Object.prototype.hasOwnProperty.call(row, "sellPrice") ||
    Object.prototype.hasOwnProperty.call(row, "purchasePrice") ||
    Object.prototype.hasOwnProperty.call(row, "isActive") ||
    Object.prototype.hasOwnProperty.call(row, "price");
}

function createOpeningBalanceEntries(fallbackRecord = {}) {
  const quantity = toFiniteNumber(fallbackRecord.quantity, 0);
  if (!quantity) return [];
  return [{
    id: createInventoryEntryId(),
    quantity,
    date: normalizeInventoryDate(
      fallbackRecord.updatedAt && typeof fallbackRecord.updatedAt.toDate === "function" ?
        fallbackRecord.updatedAt.toDate() :
        (fallbackRecord.createdAt && typeof fallbackRecord.createdAt.toDate === "function" ?
          fallbackRecord.createdAt.toDate() :
          (fallbackRecord.updatedAt || fallbackRecord.createdAt || new Date()))
    ),
    reason: "opening_balance",
    source: "migration",
    note: "Migrated from legacy inventory",
    createdAt: ""
  }];
}

function normalizeInventoryEntries(rawRows, fallbackRecord = {}) {
  if (Array.isArray(rawRows) && rawRows.length > 0) {
    if (rawRows.some((row) => isLegacyInventoryRow(row))) {
      return createOpeningBalanceEntries(fallbackRecord);
    }

    return rawRows.map((row) => ({
      id: row.id || createInventoryEntryId(),
      quantity: toFiniteNumber(row.quantity, 0),
      date: normalizeInventoryDate(row.date),
      reason: String(row.reason || "new_stock"),
      source: row.source || "manual",
      note: String(row.note || "").trim(),
      createdAt: row.createdAt || ""
    }));
  }

  return createOpeningBalanceEntries(fallbackRecord);
}

function applyInventoryDeduction(record, deductionQty, metadata = {}) {
  const inventoryDetails = normalizeInventoryEntries(record.inventoryDetails, record);
  const currentQty = inventoryDetails.reduce((sum, row) => sum + toFiniteNumber(row.quantity, 0), 0);
  const requestedQty = Math.max(0, toFiniteNumber(deductionQty, 0));
  const appliedQty = Math.min(currentQty, requestedQty);
  const nextInventoryDetails = appliedQty > 0 ? [
    ...inventoryDetails,
    {
      id: createInventoryEntryId(),
      quantity: -appliedQty,
      date: normalizeInventoryDate(metadata.date || new Date()),
      reason: "order_allocation",
      source: metadata.source || "system",
      note: metadata.note || "",
      createdAt: ""
    }
  ] : inventoryDetails;
  const nextQty = Math.max(0, currentQty - appliedQty);
  const purchasePrice = toFiniteNumber(record.purchasePrice, 0);
  const sellPrice = toFiniteNumber(record.sellPrice != null ? record.sellPrice : record.price, 0);

  return {
    inventoryDetails: nextInventoryDetails,
    purchasePrice,
    sellPrice,
    price: sellPrice,
    quantity: nextQty,
    deducted: appliedQty,
    requested: requestedQty
  };
}

function normalizeNumericString(value) {
  return String(value == null ? "" : value).replace(/\D/g, "");
}

function collectConfiguratorInventoryAdjustments(items) {
  const adjustments = new Map();

  const addAdjustment = (pathKey, quantity) => {
    if (!pathKey || !(quantity > 0)) return;
    adjustments.set(pathKey, (adjustments.get(pathKey) || 0) + quantity);
  };

  (Array.isArray(items) ? items : []).forEach((item) => {
    const qty = toFiniteNumber(item && item.quantity, 1) > 0 ? toFiniteNumber(item.quantity, 1) : 1;
    const parts = item && item.parts;
    if (!parts || typeof parts !== "object") return;

    Object.entries(parts).forEach(([partId, partState]) => {
      if (partState && partState.color && partState.color.key) {
        addAdjustment(`configurator_parts/${partId}/options/${partState.color.key}`, qty);
      }

      if (partState && partState.option && partState.option.key && partState.option.key !== "standard") {
        addAdjustment(`configurator_parts/${partId}/options/${partState.option.key}`, qty);
      }
    });
  });

  return adjustments;
}

function mergeAdjustmentMaps(target, source) {
  for (const [pathKey, quantity] of source.entries()) {
    if (!pathKey || !(quantity > 0)) continue;
    target.set(pathKey, (target.get(pathKey) || 0) + quantity);
  }
  return target;
}

function hasCustomConfiguratorSelections(item) {
  return !!(item && item.parts && typeof item.parts === "object" && Object.keys(item.parts).length > 0);
}

function getNormalItemDirectDocCandidates(item) {
  const directCandidates = [
    item?.inventoryDocPath,
    item?.firestoreDocPath,
    item?.itemDocPath,
    item?.recordPath,
    item?.normalItemId,
    item?.itemDocId,
    item?.productId,
    item?.productDocId,
    item?.itemId,
    item?.docId
  ];

  if (typeof item?.id === "string" && item.id.trim() && !/^\d+$/.test(item.id.trim())) {
    directCandidates.push(item.id.trim());
  }

  return directCandidates
    .map((candidate) => String(candidate || "").trim())
    .filter(Boolean);
}

async function resolveNormalItemDocPath(db, item) {
  if (!item || hasCustomConfiguratorSelections(item)) return "";

  const directCandidates = getNormalItemDirectDocCandidates(item);
  for (const candidate of directCandidates) {
    const normalizedPath = candidate.includes("/") ? candidate.replace(/^\/+/, "") : `items/${candidate}`;
    if (!normalizedPath.startsWith("items/")) continue;

    const snapshot = await db.doc(normalizedPath).get();
    if (snapshot.exists) return snapshot.ref.path;
  }

  const itemNumber = normalizeNumericString(item?.itemNumber || item?.inventoryNumber || item?.recordNumber);
  if (itemNumber) {
    const itemNumberSnap = await db.collection("items").where("itemNumber", "==", itemNumber).limit(1).get();
    if (!itemNumberSnap.empty) return itemNumberSnap.docs[0].ref.path;
  }

  const barcode = normalizeNumericString(item?.barcode);
  if (barcode) {
    const barcodeSnap = await db.collection("items").where("barcode", "==", barcode).limit(1).get();
    if (!barcodeSnap.empty) return barcodeSnap.docs[0].ref.path;
  }

  return "";
}

async function collectNormalItemInventoryAdjustments(items) {
  const db = getFirestore();
  const adjustments = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    if (!item || hasCustomConfiguratorSelections(item)) continue;

    const qty = toFiniteNumber(item?.quantity, 1) > 0 ? toFiniteNumber(item.quantity, 1) : 1;
    const docPath = await resolveNormalItemDocPath(db, item);
    if (!docPath) continue;

    adjustments.set(docPath, (adjustments.get(docPath) || 0) + qty);
  }

  return adjustments;
}

async function collectOrderInventoryAdjustments(items) {
  const adjustments = collectConfiguratorInventoryAdjustments(items);
  const normalItemAdjustments = await collectNormalItemInventoryAdjustments(items);
  return mergeAdjustmentMaps(adjustments, normalItemAdjustments);
}

async function applyOrderInventoryAdjustments(items, metadata = {}) {
  const db = getFirestore();
  const adjustments = await collectOrderInventoryAdjustments(items);
  const applied = [];

  if (!adjustments.size) return applied;

  await db.runTransaction(async (transaction) => {
    for (const [docPath, quantity] of adjustments.entries()) {
      const recordRef = db.doc(docPath);
      const snapshot = await transaction.get(recordRef);
      if (!snapshot.exists) continue;

      const currentData = snapshot.data() || {};
      const nextInventory = applyInventoryDeduction(currentData, quantity, {
        source: "system",
        date: new Date(),
        note: metadata.orderNumber ?
          `Allocated to order #${metadata.orderNumber}` :
          (metadata.orderId ? `Allocated to order ${metadata.orderId}` : "Allocated to order")
      });

      transaction.update(recordRef, {
        inventoryDetails: nextInventory.inventoryDetails,
        purchasePrice: nextInventory.purchasePrice,
        sellPrice: nextInventory.sellPrice,
        price: nextInventory.price,
        quantity: nextInventory.quantity,
        updatedAt: FieldValue.serverTimestamp()
      });

      applied.push({
        path: docPath,
        sourceType: docPath.startsWith("configurator_parts/") ? "configurator_option" : "normal_item",
        quantity,
        deducted: nextInventory.deducted,
        remaining: nextInventory.quantity
      });
    }
  });

  return applied;
}

async function allocateCounterValue(counterKey, startAt) {
  const db = getFirestore();
  const counterRef = db.collection("system_counters").doc(counterKey);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(counterRef);
    const currentValue = snapshot.exists ? Number(snapshot.data()?.current || startAt - 1) : startAt - 1;
    const safeCurrent = Number.isFinite(currentValue) ? currentValue : startAt - 1;
    const nextValue = safeCurrent + 1;
    transaction.set(counterRef, { current: nextValue }, { merge: true });
    return nextValue;
  });
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function humanizeKey(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getEmailOrderLabel(orderNumber) {
  const normalized = String(orderNumber == null ? "" : orderNumber).replace(/\D/g, "");
  return `#${(normalized || "0").padStart(6, "0")}`;
}

function formatMoney(value, currency) {
  return `${currency || "BHD"} ${toFiniteNumber(value, 0).toFixed(2)}`;
}

function formatAddress(shipping = {}) {
  if (!shipping || typeof shipping !== "object") return "N/A";
  if (String(shipping.method || "").toLowerCase() === "pickup") {
    return "Store Pickup";
  }

  return [
    shipping.address,
    shipping.addressLine,
    shipping.city,
    shipping.state,
    shipping.country,
    shipping.blockNumber ? `Block ${shipping.blockNumber}` : "",
    shipping.roadNumber ? `Road ${shipping.roadNumber}` : "",
    shipping.houseBuildingNumber ? `Building ${shipping.houseBuildingNumber}` : "",
    shipping.flat ? `Flat ${shipping.flat}` : "",
    shipping.saudiUnifiedAddress ? `Unified Address ${shipping.saudiUnifiedAddress}` : ""
  ].filter(Boolean).join(", ") || "N/A";
}

function getStoreSettingsSnapshot(snapshot) {
  return snapshot.exists ? (snapshot.data() || {}) : {};
}

async function getGeneralAdminSettings() {
  try {
    const snapshot = await getFirestore().collection("admin_settings").doc("general").get();
    return getStoreSettingsSnapshot(snapshot);
  } catch (error) {
    console.error("[orderHandler] settings load error", error);
    return {};
  }
}

function isValidEmailAddress(value) {
  return emailAddressPattern.test(String(value || "").trim());
}

function normalizeNamecheapHost(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "smtp.privateemail.com" || normalized === NAMECHEAP_SMTP_HOST) {
    return NAMECHEAP_SMTP_HOST;
  }
  return normalized;
}

function getSmtpConfig(settings = {}) {
  const requestedPort = Number(settings.smtpPort || process.env.SMTP_PORT || NAMECHEAP_SMTP_PORT_SSL);
  const port = requestedPort === NAMECHEAP_SMTP_PORT_STARTTLS ?
    NAMECHEAP_SMTP_PORT_STARTTLS :
    NAMECHEAP_SMTP_PORT_SSL;
  const secure = port === NAMECHEAP_SMTP_PORT_SSL;
  const host = normalizeNamecheapHost(settings.smtpHost || process.env.SMTP_HOST);
  const user = String(settings.smtpUser || process.env.SMTP_USER || "").trim().toLowerCase();
  const pass = String(settings.smtpPass || process.env.SMTP_PASS || "").trim();
  const fromEmail = String(settings.smtpFromEmail || process.env.SMTP_FROM_EMAIL || user || "").trim().toLowerCase();
  const fromName = String(settings.smtpFromName || process.env.SMTP_FROM_NAME || settings.storeName || "PS5 Controller").trim();
  const replyTo = String(settings.supportEmail || settings.adminEmail || fromEmail).trim();

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail,
    fromName,
    replyTo
  };
}

function validateSmtpConfig(config) {
  if (!config.user || !config.pass || !config.fromEmail) {
    return "Missing SMTP config. Set Namecheap Private Email fields in Admin Settings or functions/.env.";
  }
  if (config.host !== NAMECHEAP_SMTP_HOST) {
    return "Invalid SMTP host. Namecheap Private Email must use mail.privateemail.com.";
  }
  if (config.port !== NAMECHEAP_SMTP_PORT_SSL && config.port !== NAMECHEAP_SMTP_PORT_STARTTLS) {
    return "Invalid SMTP port. Namecheap Private Email supports only 465 (SSL/TLS) or 587 (STARTTLS).";
  }
  if (!isValidEmailAddress(config.user)) {
    return "Invalid SMTP user. Use the full Namecheap mailbox email address.";
  }
  if (!isValidEmailAddress(config.fromEmail)) {
    return "Invalid From email address.";
  }
  return "";
}

function getSmtpTransporter(settings = {}) {
  const config = getSmtpConfig(settings);
  const configError = validateSmtpConfig(config);
  if (configError) {
    return {
      transporter: null,
      config,
      error: configError
    };
  }

  const configKey = JSON.stringify({
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    fromEmail: config.fromEmail,
    pass: config.pass
  });

  if (!cachedSmtpTransporter || cachedSmtpTransporterKey !== configKey) {
    cachedSmtpTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: !config.secure,
      auth: {
        user: config.user,
        pass: config.pass
      },
      tls: {
        minVersion: "TLSv1.2",
        servername: config.host
      }
    });
    cachedSmtpTransporterKey = configKey;
  }

  return { transporter: cachedSmtpTransporter, config, error: "" };
}

function getCustomerFullName(customer = {}) {
  return [
    customer.firstName || customer.first_name || "",
    customer.lastName || customer.last_name || ""
  ].filter(Boolean).join(" ").trim() || "Customer";
}

function getPartEmailLabel(partId) {
  const labels = {
    shell: "Shell",
    trimpiece: "Trim Piece",
    touchpad: "Touchpad",
    allButtons: "Buttons",
    sticks: "Sticks",
    bumpersTriggers: "Bumpers & Triggers",
    psButton: "PS Button",
    backShellMain: "Back Shell"
  };
  return labels[partId] || humanizeKey(partId) || "Part";
}

function getVariantEmailLabel(variant) {
  return (
    variant?.valName ||
    variant?.name ||
    variant?.label ||
    variant?.title ||
    (variant?.hex ? String(variant.hex).toUpperCase() : "") ||
    humanizeKey(variant?.key) ||
    "Selected"
  );
}

function getItemCustomizationLines(item) {
  const lines = [];

  if (item?.parts && typeof item.parts === "object") {
    Object.entries(item.parts).forEach(([partId, partState]) => {
      if (partState?.color) {
        lines.push(`${getPartEmailLabel(partId)} color: ${getVariantEmailLabel(partState.color)}`);
      }

      if (partState?.option?.key && partState.option.key !== "standard") {
        lines.push(`${getPartEmailLabel(partId)} option: ${getVariantEmailLabel(partState.option)}`);
      }
    });
  }

  if (!lines.length && item?.config && typeof item.config === "object") {
    Object.entries(item.config)
      .filter(([, val]) => val)
      .forEach(([key, value]) => {
        lines.push(`${humanizeKey(key)}: ${String(value)}`);
      });
  }

  return lines;
}

function getSiteBaseUrl(req, settings = {}) {
  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "").trim();
  const host = String((req?.get ? req.get("host") : "") || req?.headers?.host || "").trim();
  const hostBasedUrl = host ? `${forwardedProto || "https"}://${host}` : "";
  const candidates = [
    process.env.PUBLIC_SITE_URL,
    process.env.APP_BASE_URL,
    process.env.SITE_URL,
    settings.websiteBaseUrl,
    settings.storeUrl,
    hostBasedUrl,
    req?.get ? req.get("origin") : "",
    req?.headers?.origin
  ];

  for (const candidate of candidates) {
    const normalized = String(candidate || "").trim().replace(/\/$/, "");
    if (/^https?:\/\//i.test(normalized)) {
      return normalized;
    }
  }

  return "";
}

function normalizePreviewSrc(src, siteBaseUrl) {
  const value = String(src || "").trim();
  if (!value) return "";
  if (/^(data:image\/|https?:\/\/|cid:)/i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) {
    const base = String(siteBaseUrl || "").trim().replace(/\/$/, "");
    return base ? `${base}${value}` : value;
  }
  return value;
}

function getItemPreviewLayers(item, side) {
  const key = side === "back" ? "previewBackLayers" : "previewFrontLayers";
  return Array.isArray(item?.[key]) ? item[key].filter((layer) => layer && layer.src) : [];
}

function hasItemPreview(item, side) {
  return getItemPreviewLayers(item, side).length > 0 || Boolean(side === "back" ? item?.previewBack : item?.previewFront);
}

function buildLayerPreviewDataUri(item, side, siteBaseUrl) {
  const layers = getItemPreviewLayers(item, side)
    .map((layer, index) => ({
      src: normalizePreviewSrc(layer.src, siteBaseUrl),
      opacity: Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 1,
      zIndex: Number.isFinite(Number(layer.zIndex)) ? Number(layer.zIndex) : index
    }))
    .filter((layer) => layer.src)
    .sort((a, b) => {
      if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
      return 0;
    });

  if (!layers.length) return "";

  const width = 1166;
  const height = 768;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#141829" />
  ${layers.map((layer) => `<image href="${escapeHtml(layer.src)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" opacity="${Math.max(0, Math.min(1, layer.opacity))}" />`).join("\n")}
</svg>`;

  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

async function getPreviewAssetBuffer(src, siteBaseUrl) {
  const normalizedSrc = normalizePreviewSrc(src, siteBaseUrl);
  if (!normalizedSrc || /^cid:/i.test(normalizedSrc)) return null;

  if (/^data:image\//i.test(normalizedSrc)) {
    const commaIndex = normalizedSrc.indexOf(",");
    if (commaIndex < 0) return null;
    const meta = normalizedSrc.slice(5, commaIndex).toLowerCase();
    const payload = normalizedSrc.slice(commaIndex + 1);
    if (meta.includes(";base64")) {
      return Buffer.from(payload, "base64");
    }
    return Buffer.from(decodeURIComponent(payload), "utf8");
  }

  if (/^https?:\/\//i.test(normalizedSrc)) {
    const response = await fetch(normalizedSrc);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  return null;
}

async function buildLayerPreviewRasterBuffer(item, side, siteBaseUrl, options = {}) {
  const layers = getItemPreviewLayers(item, side)
    .map((layer, index) => ({
      src: normalizePreviewSrc(layer.src, siteBaseUrl),
      opacity: Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 1,
      zIndex: Number.isFinite(Number(layer.zIndex)) ? Number(layer.zIndex) : index
    }))
    .filter((layer) => layer.src)
    .sort((a, b) => {
      if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
      return 0;
    });

  if (!layers.length) return null;

  const width = Math.max(240, Math.min(1166, Number(options.width) || 1166));
  const height = Math.round((width / 1166) * 768);
  const quality = Math.max(55, Math.min(90, Number(options.quality) || 84));
  const composites = [];

  for (const layer of layers) {
    try {
      const sourceBuffer = await getPreviewAssetBuffer(layer.src, siteBaseUrl);
      if (!sourceBuffer) continue;

      const normalizedLayer = await sharp(sourceBuffer)
        .resize(width, height, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();

      composites.push({
        input: normalizedLayer,
        top: 0,
        left: 0,
        blend: "over",
        opacity: Math.max(0, Math.min(1, layer.opacity))
      });
    } catch (error) {
      console.warn("[buildLayerPreviewRasterBuffer] layer skipped", error?.message || error);
    }
  }

  if (!composites.length) return null;

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#141829"
    }
  })
    .composite(composites)
    .jpeg({ quality, mozjpeg: true, progressive: true })
    .toBuffer();
}

async function buildOptimizedPreviewBuffer(previewSrc, siteBaseUrl, options = {}) {
  const sourceBuffer = await getPreviewAssetBuffer(previewSrc, siteBaseUrl);
  if (!sourceBuffer) return null;

  const width = Math.max(240, Math.min(1166, Number(options.width) || 1166));
  const height = Math.round((width / 1166) * 768);
  const quality = Math.max(55, Math.min(90, Number(options.quality) || 84));

  return sharp(sourceBuffer)
    .resize(width, height, {
      fit: "contain",
      background: { r: 20, g: 24, b: 41, alpha: 1 }
    })
    .flatten({ background: "#141829" })
    .jpeg({ quality, mozjpeg: true, progressive: true })
    .toBuffer();
}

function getEmailBranding(settings = {}, siteBaseUrl = "") {
  const websiteUrl = String(settings.websiteBaseUrl || siteBaseUrl || "").trim().replace(/\/$/, "");
  const logoUrl = normalizePreviewSrc(
    settings.logoUrl || (websiteUrl ? `${websiteUrl}/assets/logo.png` : ""),
    websiteUrl
  );

  return {
    websiteUrl,
    logoUrl,
    instagramUrl: String(settings.instagramUrl || "https://www.instagram.com/fhonelstore/?hl=en").trim(),
    tiktokUrl: String(settings.tiktokUrl || "").trim(),
    facebookUrl: String(settings.facebookUrl || "").trim(),
    supportEmail: String(settings.supportEmail || "").trim(),
    supportPhone: String(settings.supportPhone || "").trim()
  };
}

function buildTrackingUrl(settings, orderId, orderNumber, trackingNumber, siteBaseUrl = "") {
  const internalBaseUrl = String(siteBaseUrl || settings?.websiteBaseUrl || "").trim().replace(/\/$/, "");
  if (internalBaseUrl && orderId) {
    return `${internalBaseUrl}/trackorder?order=${encodeURIComponent(orderId)}`;
  }

  let baseUrl = String(settings?.trackingBaseUrl || "").trim();
  if (!baseUrl) return "";

  const replacements = {
    orderId: String(orderId || ""),
    orderNumber: String(orderNumber || ""),
    trackingNumber: String(trackingNumber || "")
  };

  let usedTemplate = false;
  Object.entries(replacements).forEach(([key, value]) => {
    if (baseUrl.includes(`{${key}}`)) {
      baseUrl = baseUrl.split(`{${key}}`).join(encodeURIComponent(value));
      usedTemplate = true;
    }
  });

  if (!usedTemplate) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    baseUrl = `${baseUrl}${separator}order=${encodeURIComponent(orderId)}`;
  }

  return baseUrl;
}

function serializeTrackDate(value) {
  if (!value) return "";
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function buildPublicTrackingOrder(orderId, orderDoc = {}) {
  return {
    id: orderId,
    orderNumber: orderDoc.orderNumber || "",
    status: orderDoc.status || "Pending",
    paymentStatus: orderDoc.paymentStatus || "Pending",
    total: toFiniteNumber(orderDoc.total, 0),
    subtotal: toFiniteNumber(orderDoc.subtotal, 0),
    currency: orderDoc.currency || "BHD",
    createdAt: serializeTrackDate(orderDoc.createdAt),
    updatedAt: serializeTrackDate(orderDoc.updatedAt),
    shipping: {
      method: orderDoc?.shipping?.method || "",
      trackingNumber: orderDoc?.shipping?.trackingNumber || ""
    },
    items: Array.isArray(orderDoc.items) ? orderDoc.items.map((item) => ({
      name: item?.name || "Item",
      quantity: toFiniteNumber(item?.quantity, 1) > 0 ? toFiniteNumber(item.quantity, 1) : 1,
      unitPrice: item?.unitPrice != null ? toFiniteNumber(item.unitPrice, 0) : null,
      total: item?.total != null ? toFiniteNumber(item.total, 0) : 0
    })) : []
  };
}

function buildOrderPreviewUrls(orderId, items, siteBaseUrl) {
  if (!siteBaseUrl) return [];

  const emailPreviewQuery = "w=560&q=72";

  return (Array.isArray(items) ? items : []).map((item, itemIndex) => ({
    front: hasItemPreview(item, "front") ?
      `${siteBaseUrl}/api/orderPreview?orderId=${encodeURIComponent(orderId)}&itemIndex=${itemIndex}&side=front&${emailPreviewQuery}` :
      "",
    back: hasItemPreview(item, "back") ?
      `${siteBaseUrl}/api/orderPreview?orderId=${encodeURIComponent(orderId)}&itemIndex=${itemIndex}&side=back&${emailPreviewQuery}` :
      ""
  }));
}

function renderEmailFooter(context) {
  const branding = context.branding || {};
  const footerLogoBlock = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(context.storeName)}" style="display:block;width:64px;max-width:64px;height:auto;margin:0 auto 14px;" />`
    : `<div style="margin:0 auto 14px;width:64px;height:64px;border-radius:18px;background:#111827;border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;color:#e6edf3;font-weight:800;font-size:11px;">${escapeHtml(context.storeName)}</div>`;
  const footerLinks = [
    branding.websiteUrl ? `<a href="${escapeHtml(branding.websiteUrl)}" style="color:#9efdf8;text-decoration:none;">Website</a>` : "",
    branding.instagramUrl ? `<a href="${escapeHtml(branding.instagramUrl)}" style="color:#9efdf8;text-decoration:none;">Instagram</a>` : "",
    branding.tiktokUrl ? `<a href="${escapeHtml(branding.tiktokUrl)}" style="color:#9efdf8;text-decoration:none;">TikTok</a>` : "",
    branding.facebookUrl ? `<a href="${escapeHtml(branding.facebookUrl)}" style="color:#9efdf8;text-decoration:none;">Facebook</a>` : ""
  ].filter(Boolean).join('<span style="color:#3a4556;"> · </span>');

  const contactBits = [
    branding.supportEmail ? `Email: ${escapeHtml(branding.supportEmail)}` : "",
    branding.supportPhone ? `Phone: ${escapeHtml(branding.supportPhone)}` : ""
  ].filter(Boolean).join('<span style="color:#3a4556;"> · </span>');

  return `
    <div style="margin-top:28px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
      ${footerLogoBlock}
      ${footerLinks ? `<div style="font-size:13px;color:#9efdf8;line-height:1.8;">${footerLinks}</div>` : ""}
      ${contactBits ? `<div style="margin-top:8px;font-size:12px;color:#8b949e;line-height:1.7;">${contactBits}</div>` : ""}
      <div style="margin-top:10px;font-size:12px;color:#6b7280;">${escapeHtml(context.storeName)}</div>
    </div>
  `;
}

function wrapOrderEmail({ context, title, subtitle, summaryHtml, bodyHtml, primaryActionHtml = "" }) {
  const branding = context.branding || {};
  const logoBlock = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(context.storeName)}" style="display:block;width:180px;max-width:100%;height:auto;margin:0 auto 22px;" />`
    : `<div style="margin:0 auto 22px;width:180px;height:96px;border-radius:24px;background:#111827;border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;color:#e6edf3;font-weight:800;font-size:20px;">${escapeHtml(context.storeName)}</div>`;

  return `
    <div style="margin:0;padding:32px 16px;background:#0b0f14;color:#e6edf3;font-family:Arial,sans-serif;">
      <div style="max-width:820px;margin:0 auto;background:#121821;border:1px solid rgba(255,255,255,0.08);border-radius:22px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,0.35);">
        <div style="padding:30px 30px 24px;background:linear-gradient(180deg,#151d27 0%,#121821 100%);text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
          ${logoBlock}
          <div style="font-size:30px;font-weight:800;line-height:1.2;color:#ffffff;">${escapeHtml(title)}</div>
          <div style="margin-top:10px;font-size:15px;line-height:1.7;color:#a7b0bd;">${subtitle}</div>
          ${primaryActionHtml ? `<div style="margin-top:20px;">${primaryActionHtml}</div>` : ""}
        </div>
        <div style="padding:26px 30px 30px;">
          ${summaryHtml}
          ${bodyHtml}
          ${renderEmailFooter(context)}
        </div>
      </div>
    </div>
  `;
}

function renderOrderItemsText(items, currency, previewUrls) {
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const quantity = toFiniteNumber(item?.quantity, 1) > 0 ? toFiniteNumber(item?.quantity, 1) : 1;
    const lineTotal = getOrderLineTotal(item);
    const customizationLines = getItemCustomizationLines(item);

    return [
      `${index + 1}. ${item?.name || "Custom Controller"} x${quantity} - ${formatMoney(lineTotal, currency)}`,
      ...customizationLines.map((line) => `   - ${line}`)
    ].filter(Boolean).join("\n");
  }).join("\n\n");
}

function renderOrderItemsHtml(items, currency, previewUrls) {
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const quantity = toFiniteNumber(item?.quantity, 1) > 0 ? toFiniteNumber(item?.quantity, 1) : 1;
    const lineTotal = getOrderLineTotal(item);
    const customizationLines = getItemCustomizationLines(item);
    const preview = previewUrls[index] || {};
    const previewCards = [
      preview.front ? `
        <div style="flex:1 1 240px;min-width:220px;">
          <div style="margin-bottom:8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8b949e;">Front</div>
          <div style="background:#0f141b;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:10px;text-align:center;">
            <img src="${escapeHtml(preview.front)}" alt="Front preview" style="display:block;width:100%;height:auto;border-radius:10px;background:#141829;" />
          </div>
        </div>
      ` : "",
      preview.back ? `
        <div style="flex:1 1 240px;min-width:220px;">
          <div style="margin-bottom:8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8b949e;">Back</div>
          <div style="background:#0f141b;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:10px;text-align:center;">
            <img src="${escapeHtml(preview.back)}" alt="Back preview" style="display:block;width:100%;height:auto;border-radius:10px;background:#141829;" />
          </div>
        </div>
      ` : ""
    ].filter(Boolean).join("");

    return `
      <div style="padding:18px 0;border-top:${index === 0 ? "none" : "1px solid rgba(255,255,255,0.08)"};">
        <div style="font-size:18px;font-weight:700;color:#ffffff;">${escapeHtml(item?.name || "Custom Controller")}</div>
        <div style="margin-top:6px;font-size:13px;color:#9aa4b2;">Qty ${quantity} · ${escapeHtml(formatMoney(lineTotal, currency))}</div>
        ${customizationLines.length ? `
          <ul style="margin:12px 0 0;padding-inline-start:18px;color:#cdd6df;font-size:13px;line-height:1.7;">
            ${customizationLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
          </ul>
        ` : ""}
        ${previewCards ? `
          <div style="margin-top:14px;display:flex;gap:14px;flex-wrap:wrap;">
            ${previewCards}
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

function buildOrderEmailContext({ req, settings, orderId, orderDoc }) {
  const storeName = settings.storeName || "PS5 Controller";
  const orderLabel = getEmailOrderLabel(orderDoc.orderNumber);
  const customerName = getCustomerFullName(orderDoc.customer || {});
  const customerEmail = String(orderDoc?.customer?.email || "").trim();
  const customerPhone = String(orderDoc?.customer?.phone || "").trim();
  const currency = orderDoc.currency || settings.defaultCurrency || "BHD";
  const siteBaseUrl = getSiteBaseUrl(req, settings);
  const trackingUrl = buildTrackingUrl(settings, orderId, orderDoc.orderNumber, orderDoc?.shipping?.trackingNumber || "", siteBaseUrl);
  const previewUrls = buildOrderPreviewUrls(orderId, orderDoc.items, siteBaseUrl);
  const itemsText = renderOrderItemsText(orderDoc.items, currency, previewUrls);
  const itemsHtml = renderOrderItemsHtml(orderDoc.items, currency, previewUrls);
  const addressText = formatAddress(orderDoc.shipping);
  const paymentReference = orderDoc.paymentReference || "N/A";

  return {
    storeName,
    orderLabel,
    customerName,
    customerEmail,
    customerPhone,
    currency,
    itemsText,
    itemsHtml,
    addressText,
    paymentReference,
    paymentMethod: orderDoc.paymentMethod || "tap",
    totalText: formatMoney(orderDoc.total, currency),
    subtotalText: formatMoney(orderDoc.subtotal, currency),
    trackingUrl,
    urgency: orderDoc.urgency || "Normal",
    createdAtText: new Date().toLocaleString(),
    branding: getEmailBranding(settings, siteBaseUrl)
  };
}

function buildAdminOrderEmail(context) {
  const subject = `${context.storeName} | New paid order ${context.orderLabel}`;
  const text = [
    `A new paid order has been created in ${context.storeName}.`,
    "",
    `Order: ${context.orderLabel}`,
    `Customer: ${context.customerName}`,
    `Email: ${context.customerEmail || "N/A"}`,
    `Phone: ${context.customerPhone || "N/A"}`,
    `Payment method: ${context.paymentMethod}`,
    `Payment reference: ${context.paymentReference}`,
    `Urgency: ${context.urgency}`,
    `Subtotal: ${context.subtotalText}`,
    `Total: ${context.totalText}`,
    `Shipping address: ${context.addressText}`,
    context.trackingUrl ? `Tracking link: ${context.trackingUrl}` : "",
    "",
    "Items:",
    context.itemsText || "No items"
  ].filter(Boolean).join("\n");
  const summaryHtml = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:22px;">
      <div style="padding:14px;border-radius:14px;background:#0f141b;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;">Customer</div><div style="margin-top:6px;color:#ffffff;font-weight:700;">${escapeHtml(context.customerName)}</div></div>
      <div style="padding:14px;border-radius:14px;background:#0f141b;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;">Email</div><div style="margin-top:6px;color:#d7dee7;">${escapeHtml(context.customerEmail || "N/A")}</div></div>
      <div style="padding:14px;border-radius:14px;background:#0f141b;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;">Phone</div><div style="margin-top:6px;color:#d7dee7;">${escapeHtml(context.customerPhone || "N/A")}</div></div>
      <div style="padding:14px;border-radius:14px;background:#0f141b;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;">Urgency</div><div style="margin-top:6px;color:#d7dee7;">${escapeHtml(context.urgency)}</div></div>
      <div style="padding:14px;border-radius:14px;background:#0f141b;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;">Payment</div><div style="margin-top:6px;color:#d7dee7;">${escapeHtml(context.paymentMethod)}</div></div>
      <div style="padding:14px;border-radius:14px;background:#0f141b;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;">Reference</div><div style="margin-top:6px;color:#d7dee7;">${escapeHtml(context.paymentReference)}</div></div>
      <div style="padding:14px;border-radius:14px;background:#0f141b;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;">Subtotal</div><div style="margin-top:6px;color:#d7dee7;">${escapeHtml(context.subtotalText)}</div></div>
      <div style="padding:14px;border-radius:14px;background:#0f141b;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;">Total</div><div style="margin-top:6px;color:#9efdf8;font-weight:800;">${escapeHtml(context.totalText)}</div></div>
    </div>
  `;
  const bodyHtml = `
    <div style="margin-bottom:20px;padding:16px;border-radius:16px;background:#0f141b;border:1px solid rgba(255,255,255,0.08);">
      <div style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;">Shipping address</div>
      <div style="margin-top:8px;color:#d7dee7;line-height:1.7;">${escapeHtml(context.addressText)}</div>
    </div>
    <div style="font-size:18px;font-weight:700;color:#ffffff;margin-bottom:10px;">Items</div>
    <div>${context.itemsHtml || "<div style=\"color:#8b949e;\">No items</div>"}</div>
  `;
  const primaryActionHtml = context.trackingUrl
    ? `<a href="${escapeHtml(context.trackingUrl)}" style="display:inline-block;background:#0de1d8;color:#07131a;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:800;">Open Tracking</a>`
    : "";
  const html = wrapOrderEmail({
    context,
    title: `New paid order ${context.orderLabel}`,
    subtitle: `A new paid order was created in ${escapeHtml(context.storeName)}.`,
    summaryHtml,
    bodyHtml,
    primaryActionHtml
  });

  return { subject, text, html };
}

function buildCustomerOrderEmail(context) {
  const subject = `${context.storeName} | Your order ${context.orderLabel} is confirmed`;
  const text = [
    `Hello ${context.customerName},`,
    "",
    `Your paid order ${context.orderLabel} has been received successfully.`,
    `Payment reference: ${context.paymentReference}`,
    `Total: ${context.totalText}`,
    context.trackingUrl ? `Tracking link: ${context.trackingUrl}` : "",
    "",
    "Order details:",
    context.itemsText || "No items",
    "",
    `Shipping address: ${context.addressText}`,
    "",
    `Thank you,`,
    context.storeName
  ].filter(Boolean).join("\n");
  const summaryHtml = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:22px;">
      <div style="padding:14px;border-radius:14px;background:#0f141b;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;">Order</div><div style="margin-top:6px;color:#ffffff;font-weight:700;">${escapeHtml(context.orderLabel)}</div></div>
      <div style="padding:14px;border-radius:14px;background:#0f141b;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;">Payment Reference</div><div style="margin-top:6px;color:#d7dee7;">${escapeHtml(context.paymentReference)}</div></div>
      <div style="padding:14px;border-radius:14px;background:#0f141b;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;">Total</div><div style="margin-top:6px;color:#9efdf8;font-weight:800;">${escapeHtml(context.totalText)}</div></div>
      <div style="padding:14px;border-radius:14px;background:#0f141b;border:1px solid rgba(255,255,255,0.08);"><div style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;">Email</div><div style="margin-top:6px;color:#d7dee7;">${escapeHtml(context.customerEmail || "N/A")}</div></div>
    </div>
  `;
  const bodyHtml = `
    <div style="margin-bottom:20px;padding:16px;border-radius:16px;background:#0f141b;border:1px solid rgba(255,255,255,0.08);">
      <div style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;">Shipping address</div>
      <div style="margin-top:8px;color:#d7dee7;line-height:1.7;">${escapeHtml(context.addressText)}</div>
    </div>
    <div style="font-size:18px;font-weight:700;color:#ffffff;margin-bottom:10px;">Your items</div>
    <div>${context.itemsHtml || "<div style=\"color:#8b949e;\">No items</div>"}</div>
  `;
  const primaryActionHtml = context.trackingUrl
    ? `<a href="${escapeHtml(context.trackingUrl)}" style="display:inline-block;background:#0de1d8;color:#07131a;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:800;">Track your order</a>`
    : "";
  const html = wrapOrderEmail({
    context,
    title: `Your order ${context.orderLabel} is confirmed`,
    subtitle: `Hello ${escapeHtml(context.customerName)}, your paid order has been received successfully.`,
    summaryHtml,
    bodyHtml,
    primaryActionHtml
  });

  return { subject, text, html };
}

async function sendOrderNotificationEmails({ req, orderId, orderDoc, settings }) {
  const adminRecipient = String(settings?.adminEmail || "").trim();
  const customerRecipient = String(orderDoc?.customer?.email || "").trim();
  const emailNotifications = {
    admin: {
      to: adminRecipient,
      status: adminRecipient ? "pending" : "missing_recipient",
      sentAt: "",
      messageId: "",
      error: ""
    },
    customer: {
      to: customerRecipient,
      status: customerRecipient ? "pending" : "missing_recipient",
      sentAt: "",
      messageId: "",
      error: ""
    }
  };

  if (String(orderDoc?.paymentStatus || "") !== "Paid") {
    if (adminRecipient) emailNotifications.admin.status = "skipped_unpaid";
    if (customerRecipient) emailNotifications.customer.status = "skipped_unpaid";
    return emailNotifications;
  }

  const { transporter, config, error } = getSmtpTransporter(settings);
  if (!transporter) {
    if (adminRecipient) {
      emailNotifications.admin.status = "not_configured";
      emailNotifications.admin.error = error;
    }
    if (customerRecipient) {
      emailNotifications.customer.status = "not_configured";
      emailNotifications.customer.error = error;
    }
    return emailNotifications;
  }

  const from = {
    name: config.fromName,
    address: config.fromEmail
  };
  const context = buildOrderEmailContext({ req, settings, orderId, orderDoc });
  const adminMail = buildAdminOrderEmail(context);
  const customerMail = buildCustomerOrderEmail(context);

  const deliveries = [];

  if (adminRecipient) {
    deliveries.push(
      transporter.sendMail({
        from,
        to: adminRecipient,
        replyTo: config.replyTo || undefined,
        subject: adminMail.subject,
        text: adminMail.text,
        html: adminMail.html
      }).then((info) => {
        emailNotifications.admin.status = "sent";
        emailNotifications.admin.sentAt = new Date().toISOString();
        emailNotifications.admin.messageId = info && info.messageId ? String(info.messageId) : "";
      }).catch((sendError) => {
        emailNotifications.admin.status = "failed";
        emailNotifications.admin.error = sendError.message || "Admin email failed";
      })
    );
  }

  if (customerRecipient) {
    deliveries.push(
      transporter.sendMail({
        from,
        to: customerRecipient,
        replyTo: config.replyTo || undefined,
        subject: customerMail.subject,
        text: customerMail.text,
        html: customerMail.html
      }).then((info) => {
        emailNotifications.customer.status = "sent";
        emailNotifications.customer.sentAt = new Date().toISOString();
        emailNotifications.customer.messageId = info && info.messageId ? String(info.messageId) : "";
      }).catch((sendError) => {
        emailNotifications.customer.status = "failed";
        emailNotifications.customer.error = sendError.message || "Customer email failed";
      })
    );
  }

  await Promise.all(deliveries);
  return emailNotifications;
}

exports.orderHandler = functions
  .runWith({ memory: "512MB", timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(204).send("");

    const requestPath = String((req.path || req.url || "/").split("?")[0] || "/")
      .replace(/\/+$/, "") || "/";

    if (req.method === "GET") {
      const isTrackOrderRequest = requestPath === "/trackorder" || requestPath === "/api/trackorder";
      if (!isTrackOrderRequest) {
        return res.status(405).json({ error: "method_not_allowed" });
      }

      try {
        const orderId = String(req.query.order || req.query.order_id || req.query.id || "").trim();
        if (!orderId) {
          return res.status(400).json({ error: "missing_order_id" });
        }

        const snapshot = await getFirestore().collection("orders").doc(orderId).get();
        if (!snapshot.exists) {
          return res.status(404).json({ error: "order_not_found" });
        }

        return res.json({
          success: true,
          order: buildPublicTrackingOrder(snapshot.id, snapshot.data() || {})
        });
      } catch (error) {
        console.error("[orderHandler] trackorder error", error);
        return res.status(500).json({ error: error.message || "trackorder_failed" });
      }
    }

    if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

    try {
      const body = req.body || {};
      const amounts = getNormalizedOrderAmounts(body);
      const orderNumber = await allocateCounterValue("orders", 500000);
      const paymentState = String(body.paymentStatus || body.paymentDetails?.status || "").toUpperCase();
      const paymentStatus = body.paymentStatus ||
        (paymentState === "CAPTURED" || paymentState === "AUTHORIZED" ? "Paid" :
          (paymentState ? "Failed" : "Pending"));
      const paymentReference = body.paymentReference ||
        body.paymentDetails?.reference?.payment ||
        body.paymentDetails?.reference?.transaction ||
        body.paymentDetails?.id ||
        "";
      const initialOrderStatus = getInitialOrderStatus(paymentStatus);
      const adminSettings = await getGeneralAdminSettings();

      // The body directly comes from Checkour form -> /api/createOrder
      const orderDoc = {
        customer: {
          firstName: body.firstName || "",
          lastName: body.lastName || "",
          first_name: body.firstName || "",
          last_name: body.lastName || "",
          email: body.email || "",
          phone: body.phoneFull || body.phone || ""
        },
        shipping: {
          method: body.shippingMethod || "delivery",
          country: body.country || "BH",
          city: body.city || "",
          state: body.state || "",
          saudiUnifiedAddress: body.saudiUnifiedAddress || "",
          addressLine: body.address || "",
          address: body.addressLine1 || "",
          blockNumber: body.blockNumber || "",
          roadNumber: body.roadNumber || "",
          houseBuildingNumber: body.houseBuildingNumber || "",
          flat: body.flat || "",
          cost: amounts.shippingCost
        },
        items: amounts.items,
        orderNumber,
        subtotal: amounts.subtotal,
        total: amounts.total,
        currency: body.currency || "BHD",
        status: initialOrderStatus,
        urgency: body.urgency || "Normal",
        paymentStatus,
        paymentReference,
        paymentDetails: body.paymentDetails || {},
        paymentMethod: body.paymentMethod || "tap",
        payment_method: body.paymentMethod || "tap",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      const docRef = await getFirestore().collection("orders").add(orderDoc);
      let inventorySyncStatus = "not_required";
      let inventoryAdjustments = [];
      let inventorySyncError = "";
      let emailNotifications = {
        admin: { to: adminSettings.adminEmail || "", status: "pending", sentAt: "", messageId: "", error: "" },
        customer: { to: body.email || "", status: "pending", sentAt: "", messageId: "", error: "" }
      };

      try {
        inventoryAdjustments = await applyOrderInventoryAdjustments(amounts.items, {
          orderId: docRef.id,
          orderNumber
        });
        if (inventoryAdjustments.length) {
          inventorySyncStatus = "completed";
        }
      } catch (inventoryError) {
        inventorySyncStatus = "failed";
        console.error("[orderHandler] inventory sync error", inventoryError);
        inventorySyncError = inventoryError.message || "Inventory deduction failed";
      }

      try {
        emailNotifications = await sendOrderNotificationEmails({
          req,
          orderId: docRef.id,
          orderDoc: {
            ...orderDoc,
            id: docRef.id
          },
          settings: adminSettings
        });
      } catch (emailError) {
        console.error("[orderHandler] email notification error", emailError);
        const fallbackError = emailError.message || "Email notification failed";
        emailNotifications = {
          admin: {
            to: adminSettings.adminEmail || "",
            status: adminSettings.adminEmail ? "failed" : "missing_recipient",
            sentAt: "",
            messageId: "",
            error: fallbackError
          },
          customer: {
            to: body.email || "",
            status: body.email ? "failed" : "missing_recipient",
            sentAt: "",
            messageId: "",
            error: fallbackError
          }
        };
      }

      try {
        const orderUpdate = {
          inventorySyncStatus,
          emailNotifications,
          updatedAt: FieldValue.serverTimestamp()
        };
        if (inventoryAdjustments.length) orderUpdate.inventoryAdjustments = inventoryAdjustments;
        if (inventorySyncError) orderUpdate.inventorySyncError = inventorySyncError;
        await docRef.update(orderUpdate);
      } catch (orderUpdateError) {
        console.error("[orderHandler] post-create update error", orderUpdateError);
      }

      res.json({
        success: true,
        orderId: docRef.id,
        orderNumber,
        inventorySyncStatus,
        emailNotifications,
        total: orderDoc.total,
        status: initialOrderStatus
      });
    } catch (err) {
      console.error("[orderHandler] error", err);
      res.status(500).json({
        error: err.message
      });
    }
  });

// Serve preview images (e.g., data URI → svg) for Zoho descriptions
exports.preview = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  const data = req.query.data;
  return sendImageValueResponse(res, data);
});

exports.orderPreview = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    const orderId = String(req.query.orderId || "").trim();
    const itemIndex = Math.max(0, parseInt(req.query.itemIndex, 10) || 0);
    const side = String(req.query.side || "front").toLowerCase() === "back" ? "back" : "front";
    const width = Math.max(240, Math.min(1166, parseInt(req.query.w || req.query.width, 10) || 1166));
    const quality = Math.max(55, Math.min(90, parseInt(req.query.q || req.query.quality, 10) || 84));

    if (!orderId) {
      return res.status(400).send("Missing orderId");
    }

    const snapshot = await getFirestore().collection("orders").doc(orderId).get();
    if (!snapshot.exists) {
      return res.status(404).send("Order not found");
    }

    const settings = await getGeneralAdminSettings();
    const siteBaseUrl = getSiteBaseUrl(req, settings);
    const order = snapshot.data() || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const item = items[itemIndex];
    if (!item) {
      return res.status(404).send("Order item not found");
    }

    const previewRasterBuffer = await buildLayerPreviewRasterBuffer(item, side, siteBaseUrl, { width, quality });
    if (previewRasterBuffer) {
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(previewRasterBuffer);
    }

    const previewValue = side === "back" ? (item.previewBack || null) : (item.previewFront || null);
    const optimizedPreviewBuffer = previewValue
      ? await buildOptimizedPreviewBuffer(previewValue, siteBaseUrl, { width, quality })
      : null;
    if (optimizedPreviewBuffer) {
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(optimizedPreviewBuffer);
    }

    const previewFallbackValue = previewValue || buildLayerPreviewDataUri(item, side, siteBaseUrl);

    if (!previewFallbackValue) {
      return res.status(404).send("Preview not found");
    }

    return sendImageValueResponse(res, previewFallbackValue);
  } catch (error) {
    console.error("[orderPreview] error", error);
    return res.status(500).send(error.message || "Failed to load preview");
  }
});

exports.tapPaymentHandler = functions
  .runWith({ memory: "256MB", timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") return res.status(204).send("");

    try {
      if (req.method !== "POST") throw new Error("Method not allowed");

      const body = req.body || {};
      const { amount, currency, customer, redirect_url, post_url } = body;
      const numericAmount = Number(amount);

      const TAP_SECRET = process.env.TAP_SECRET_KEY || "";

      if (!TAP_SECRET) {
        throw new Error("Missing TAP_SECRET_KEY in backend config");
      }

      if (!(numericAmount > 0)) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const payload = {
        amount: numericAmount.toFixed(2),
        currency: currency || "BHD",
        customer: {
          first_name: customer.first_name || "Customer",
          last_name: customer.last_name || ".",
          email: customer.email,
          phone: {
            country_code: (customer.phone && customer.phone.country_code) || "965",
            number: (customer.phone && customer.phone.number) || "00000000"
          }
        },
        source: { id: "src_all" },
        redirect: { url: redirect_url || "http://localhost:5173/payment/success" },
        post: { url: post_url || null }
      };

      console.log("[tapPaymentHandler] initiating charge:", payload);

      const tapRes = await fetch("https://api.tap.company/v2/charges", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TAP_SECRET}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const tapJson = await tapRes.json();
      console.log("[tapPaymentHandler] response:", tapJson);

      if (!tapRes.ok) {
        throw new Error("Tap API Error: " + (tapJson.errors ? JSON.stringify(tapJson.errors) : "Unknown"));
      }

      res.json(tapJson);
    } catch (err) {
      console.error("[tapPaymentHandler] error", err);
      res.status(500).json({ error: err.message });
    }
  });

exports.tapVerificationHandler = functions
  .runWith({ memory: "256MB", timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") return res.status(204).send("");

    const tapId = req.query.tap_id || req.body.tap_id;

    if (!tapId) {
      return res.status(400).json({ error: "Missing tap_id" });
    }

    try {
      const TAP_SECRET = process.env.TAP_SECRET_KEY || "";
      if (!TAP_SECRET) throw new Error("Missing TAP_SECRET_KEY");

      const tapRes = await fetch(`https://api.tap.company/v2/charges/${tapId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${TAP_SECRET}`
        }
      });

      const tapJson = await tapRes.json();

      if (!tapRes.ok) {
        throw new Error("Tap Verification Failed");
      }

      res.json(tapJson);
    } catch (err) {
      console.error("[tapVerificationHandler] error", err);
      res.status(500).json({ error: err.message });
    }
  });
