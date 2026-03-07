import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.ZOHO_PROXY_PORT || 5174;

const ZOHO_TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const ZOHO_BASE = "https://www.zohoapis.com";

const REQUIRED_ENV = [
  "ZOHO_CLIENT_ID",
  "ZOHO_CLIENT_SECRET",
  "ZOHO_REFRESH_TOKEN",
  "ZOHO_ORG_ID",
];

function ensureEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error("Missing env vars: " + missing.join(", "));
  }
}

let accessToken = null;
let accessTokenExpiry = 0;

async function refreshAccessToken() {
  ensureEnv();
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
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
  if (!json.access_token) {
    throw new Error("Zoho refresh response missing access_token: " + JSON.stringify(json));
  }

  accessToken = json.access_token;
  const expiresIn = Number(json.expires_in_sec || json.expires_in || 0);
  accessTokenExpiry = Date.now() + expiresIn * 1000 - 60_000; // refresh 1 min early
  return accessToken;
}

async function getAccessToken() {
  if (accessToken && Date.now() < accessTokenExpiry) return accessToken;
  return refreshAccessToken();
}

app.use(cors());
// Preserve raw body for non-GET requests so we can forward exactly.
app.use(
  express.raw({
    type: () => true,
    limit: "10mb",
  })
);

app.use("/zoho", async (req, res) => {
  try {
    ensureEnv();
    let path = req.originalUrl.replace(/^\/zoho/, "") || "/";
    // Normalize to /inventory/v1/...
    if (path.startsWith("/api/")) {
      path = path.replace(/^\/api\//, "/inventory/");
    }
    if (!path.startsWith("/inventory/")) {
      path = "/inventory" + (path.startsWith("/") ? path : "/" + path);
    }
    const targetUrl = ZOHO_BASE + path;

    const attempt = async (retry) => {
      const token = await getAccessToken();
      const hopByHop = [
        "connection",
        "proxy-connection",
        "keep-alive",
        "te",
        "transfer-encoding",
        "upgrade",
        "host",
      ];
      const headers = {};
      Object.entries(req.headers).forEach(([key, value]) => {
        const lower = key.toLowerCase();
        if (hopByHop.includes(lower)) return;
        if (lower === "content-length") return;
        headers[key] = value;
      });
      headers.authorization = `Zoho-oauthtoken ${token}`;

      // Ensure org id is present in query
      const urlObj = new URL(targetUrl);
      if (!urlObj.searchParams.has("organization_id")) {
        urlObj.searchParams.set("organization_id", process.env.ZOHO_ORG_ID);
      }

      const forwardRes = await fetch(urlObj.toString(), {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
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
        const buf = await forwardRes.arrayBuffer();
        res.send(Buffer.from(buf));
      }
    };

    await attempt(true);
  } catch (err) {
    console.error("[Zoho Proxy] Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Zoho proxy error", detail: err.message });
    } else {
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Zoho proxy running on http://localhost:${PORT}`);
});
