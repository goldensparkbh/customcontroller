import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import readline from "readline/promises";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");

// Adjust scopes as needed; ensure they align with the app setup in Zoho.
const SCOPES = "ZohoInventory.items.READ,ZohoInventory.salesorders.CREATE,ZohoInventory.contacts.READ";
const REDIRECT_URI = "https://ps5-controller.web.app/";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const env = {};
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env[key] = value;
  });
  return env;
}

function writeEnvFile(filePath, envObj) {
  const sortedKeys = Object.keys(envObj);
  const lines = sortedKeys.map((key) => `${key}=${envObj[key] ?? ""}`);
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

function getEnv(key, envFileObj) {
  return process.env[key] || envFileObj[key];
}

function buildAuthUrl(clientId, state = "zohoState") {
  const params = new URLSearchParams({
    scope: SCOPES,
    client_id: clientId,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    redirect_uri: REDIRECT_URI,
    state,
  });
  return `https://accounts.zoho.com/oauth/v2/auth?${params.toString()}`;
}

function openUrl(url) {
  const platform = os.platform();
  let cmd;
  if (platform === "darwin") cmd = "open";
  else if (platform === "win32") cmd = "start";
  else cmd = "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
  } catch (err) {
    console.warn("Unable to auto-open the browser. Please open this URL manually:\n", url, err);
  }
}

async function exchangeAuthCode({ clientId, clientSecret, code }) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    code,
  });

  const res = await fetch("https://accounts.zoho.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho code exchange failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (!json.access_token || !json.refresh_token) {
    throw new Error("Response missing access_token or refresh_token: " + JSON.stringify(json));
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in_sec || json.expires_in,
    tokenType: json.token_type,
  };
}

async function runInteractiveFlow() {
  const envFile = readEnvFile(envPath);
  const clientId = getEnv("ZOHO_CLIENT_ID", envFile);
  const clientSecret = getEnv("ZOHO_CLIENT_SECRET", envFile);
  if (!clientId || !clientSecret) {
    console.error("Please set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET in .env or your shell.");
    process.exit(1);
  }

  const authUrl = buildAuthUrl(clientId);
  console.log("Opening Zoho authorization URL in your browser...");
  console.log(authUrl);
  openUrl(authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await rl.question("Paste the 'code' parameter from the redirected URL here: ");
  rl.close();

  if (!code) {
    console.error("No code provided. Exiting.");
    process.exit(1);
  }

  console.log("Exchanging code for tokens...");
  const { accessToken, refreshToken, expiresIn, tokenType } = await exchangeAuthCode({
    clientId,
    clientSecret,
    code,
  });

  const expiresAt = expiresIn
    ? new Date(Date.now() + Number(expiresIn) * 1000).toISOString()
    : "";

  const nextEnv = { ...envFile };
  nextEnv.ZOHO_CLIENT_ID = clientId;
  nextEnv.ZOHO_CLIENT_SECRET = clientSecret;
  nextEnv.ZOHO_REFRESH_TOKEN = refreshToken;
  nextEnv.VITE_ZOHO_ACCESS_TOKEN = accessToken;
  if (expiresAt) nextEnv.ZOHO_ACCESS_TOKEN_EXPIRES_AT = expiresAt;
  if (tokenType) nextEnv.ZOHO_ACCESS_TOKEN_TYPE = tokenType;

  writeEnvFile(envPath, nextEnv);

  console.log("Tokens saved to .env (VITE_ZOHO_ACCESS_TOKEN, ZOHO_REFRESH_TOKEN).");
  if (expiresAt) console.log("Access token expires at:", expiresAt);
  console.log("You can refresh later via: npm run refresh:zoho-token");
}

runInteractiveFlow().catch((err) => {
  console.error(err);
  process.exit(1);
});
