const functions = require("firebase-functions/v1");
const dotenv = require("dotenv");
const PDFDocument = require("pdfkit");
const SVGtoPDF = require("svg-to-pdfkit");
const fs = require("fs");
const path = require("path");
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

function buildControllerSvg(config) {
  const entries = Object.entries(config || {}).filter(([, val]) => val);
  if (!entries.length) return null;
  const width = 1166;
  const height = 768;
  const baseHref = getBaseControllerDataUri();
  const defs = [];
  const overlays = [];
  entries.forEach(([part, color], idx) => {
    const maskUri = getMaskDataUri(part);
    if (!maskUri) return;
    const maskId = `mask_${part}_${idx}`;
    defs.push(
      `<mask id="${maskId}"><image href="${maskUri}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" /></mask>`
    );
    const fill = typeof color === "string" ? color : (color && color.hex) || "#4ade80";
    overlays.push(
      `<rect x="0" y="0" width="${width}" height="${height}" fill="${fill}" mask="url(#${maskId})" opacity="0.95" />`
    );
  });
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#0b0b0f">
  <defs>
    ${defs.join("\n")}
  </defs>
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

exports.orderHandler = functions
  .runWith({ memory: "512MB", timeoutSeconds: 120 })
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

    let zohoEnabled = true;
    try {
      ensureConfig();
    } catch {
      zohoEnabled = false;
    }

    try {
      const body = req.body || {};
      const customer = body.customer || body || {};
      const cart = Array.isArray(body.items || body.cart) ? (body.items || body.cart) : [];
      const total = cart.reduce((s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0), 0);

      let contact_id = null;
      let salesorder = null;
      let so_confirm = null;
      let invoice = null;
      let payment = null;

      if (zohoEnabled) {
        try {
          const token = await getAccessToken();
          const itemsJson = await fetchZohoJson(`${ZOHO_BASE}/inventory/v1/items?organization_id=${ZOHO_ORG_ID}&per_page=200`, {
            headers: { Authorization: `Zoho-oauthtoken ${token}` }
          }, "items");
          const itemMap = {};
          (itemsJson.items || []).forEach(it => {
            const nameKey = (it.name || it.item_name || "").toLowerCase();
            itemMap[nameKey] = it;
          });
          const baseItem = itemMap["ps5_original_controller"];

          const line_items = cart.map(it => {
            const nameKey = (it.name || "").toLowerCase();
            const mapped = itemMap[nameKey];
            const descParts = [];
            const desc = formatCustomizations(it.config);
            if (desc) descParts.push(desc);
            const composedDesc = descParts.join("\n");
            return {
              item_id: mapped ? mapped.item_id : (baseItem ? baseItem.item_id : undefined),
              name: it.name || "PS5 Controller",
              description: composedDesc,
              quantity: it.quantity || 1,
              rate: it.unitPrice || 0
            };
          });

          const contact_name = customer.name || customer.fullName || "PS5 Customer";
          const { first: first_name, last: last_name } = splitName(contact_name);
          const shorten = (v, max = 60) => (v || "").toString().slice(0, max);
          const contactPayload = {
            contact_name: contact_name.slice(0, 50),
            display_name: contact_name.slice(0, 50),
            company_name: customer.company || "",
            customer_sub_type: "individual",
            email: customer.email || "",
            phone: customer.phone || customer.mobile || "",
            billing_address: buildAddress(customer),
            shipping_address: buildAddress(customer),
            contact_persons: [
              {
                salutation: customer.salutation || "",
                first_name,
                last_name,
                email: customer.email || "",
                phone: customer.phone || "",
                mobile: customer.mobile || customer.phone || ""
              }
            ]
          };

          const shippingAddress = buildAddress(customer);
          const billingAddress = buildAddress(customer);

          try {
            const contactJson = await fetchZohoJson(`${ZOHO_BASE}/inventory/v1/contacts?organization_id=${ZOHO_ORG_ID}`, {
              method: "POST",
              headers: {
                Authorization: `Zoho-oauthtoken ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(contactPayload)
            }, "contacts");
            contact_id = contactJson.contact ? contactJson.contact.contact_id : null;
          } catch (e) {
            // ignore
          }

          try {
            const soPayload = {
              customer_id: contact_id || undefined,
              contact_name,
              customer_name: contact_name,
              billing_address: billingAddress,
              shipping_address: shippingAddress,
              line_items,
              payment_options: { payment_mode: "cash" }
            };
            salesorder = await fetchZohoJson(`${ZOHO_BASE}/inventory/v1/salesorders?organization_id=${ZOHO_ORG_ID}`, {
              method: "POST",
              headers: {
                Authorization: `Zoho-oauthtoken ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(soPayload)
            }, "salesorders");
          } catch (e) {
            // ignore
          }

          // Confirm the sales order if created
          if (salesorder && salesorder.salesorder && salesorder.salesorder.salesorder_id) {
            try {
              const soId = salesorder.salesorder.salesorder_id;
              so_confirm = await fetchZohoJson(`${ZOHO_BASE}/inventory/v1/salesorders/${soId}/status/confirmed?organization_id=${ZOHO_ORG_ID}`, {
                method: "POST",
                headers: { Authorization: `Zoho-oauthtoken ${token}` }
              }, "salesorders_confirm");
            } catch (e) {
              // ignore
            }
          }

          // Create invoice regardless (attach salesorder_id when available)
          try {
            const invPayload = {
              customer_id: contact_id || undefined,
              salesorder_id: salesorder && salesorder.salesorder && salesorder.salesorder.salesorder_id ? salesorder.salesorder.salesorder_id : undefined,
              contact_name,
              customer_name: contact_name,
              billing_address: billingAddress,
              shipping_address: shippingAddress,
              line_items,
              payment_options: { payment_mode: "cash" }
            };
            invoice = await fetchZohoJson(`${ZOHO_BASE}/inventory/v1/invoices?organization_id=${ZOHO_ORG_ID}`, {
              method: "POST",
              headers: {
                Authorization: `Zoho-oauthtoken ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(invPayload)
            }, "invoices");
          } catch (e) {
            // ignore
          }

          // Record payment against the invoice (cash, paid)
          if (invoice && invoice.invoice && invoice.invoice.invoice_id) {
            try {
              const payPayload = {
                customer_id: contact_id || undefined,
                payment_mode: "cash",
                amount: total,
                invoices: [
                  {
                    invoice_id: invoice.invoice.invoice_id,
                    amount_applied: total
                  }
                ]
              };
              payment = await fetchZohoJson(`${ZOHO_BASE}/inventory/v1/customerpayments?organization_id=${ZOHO_ORG_ID}`, {
                method: "POST",
                headers: {
                  Authorization: `Zoho-oauthtoken ${token}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(payPayload)
              }, "customerpayments");
            } catch (e) {
              // ignore
            }
          }

          // Attach customization PDF to the sales order
          if (salesorder && salesorder.salesorder && salesorder.salesorder.salesorder_id) {
            try {
              const pdfBuffer = await buildCustomizationPdf(cart);
              console.log("[orderHandler] attaching customizations.pdf, bytes:", pdfBuffer.length);
              const blob = new BlobCtor([pdfBuffer], { type: "application/pdf" });
              const form = new FormDataCtor();
              // some runtimes expect options object; filename string works across undici/node
              form.append("attachment", blob, "customizations.pdf");
              const url = `${ZOHO_BASE}/inventory/v1/salesorders/${salesorder.salesorder.salesorder_id}/attachment?organization_id=${ZOHO_ORG_ID}`;
              const res = await fetch(url, {
                method: "POST",
                headers: {
                  Authorization: `Zoho-oauthtoken ${token}`
                },
                body: form
              });
              const txt = await res.text();
              if (!res.ok) {
                console.error("[orderHandler] attach pdf failed", res.status, txt);
              } else {
                let json = null;
                try { json = JSON.parse(txt); } catch { /* ignore */ }
                if (json && json.code !== 0) {
                  console.error("[orderHandler] attach pdf non-zero code", json);
                } else {
                  console.log("[orderHandler] attach pdf ok");
                }
              }
            } catch (e) {
              console.error("[orderHandler] attach pdf error", e);
            }
          }

        } catch (err) {
          console.error("[orderHandler] Zoho error", err);
        }
      }

      res.json({
        status: "paid_demo",
        payment_method: "cash",
        total,
        contact_id,
        salesorder,
        so_confirm,
        invoice,
        payment
      });
    } catch (err) {
      console.error("[orderHandler] error", err);
      res.json({
        status: "paid_demo",
        payment_method: "cash",
        total: 0,
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
  if (!data || typeof data !== "string") {
    return res.status(400).send("Missing data param");
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
  // If it's already a URL, redirect
  if (/^https?:\/\//i.test(data)) {
    return res.redirect(data);
  }
  return res.status(400).send("Unsupported data format");
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

      const TAP_SECRET = process.env.TAP_SECRET_KEY || "";

      if (!TAP_SECRET) {
        throw new Error("Missing TAP_SECRET_KEY in backend config");
      }

      const payload = {
        amount: Number(amount).toFixed(2),
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
