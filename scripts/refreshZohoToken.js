import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");

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

async function fetchAccessToken({ clientId, clientSecret, refreshToken }) {
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://accounts.zoho.com/oauth/v2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho token request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (!json.access_token) {
    throw new Error("Zoho response missing access_token: " + JSON.stringify(json));
  }

  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in_sec || json.expires_in,
    tokenType: json.token_type,
    raw: json,
  };
}

async function main() {
  const envFile = readEnvFile(envPath);
  const clientId = getEnv("ZOHO_CLIENT_ID", envFile);
  const clientSecret = getEnv("ZOHO_CLIENT_SECRET", envFile);
  const refreshToken = getEnv("ZOHO_REFRESH_TOKEN", envFile);

  if (!clientId || !clientSecret || !refreshToken) {
    console.error(
      "Missing required env values. Please ensure ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN are set in .env or your shell."
    );
    process.exit(1);
  }

  console.log("Requesting new Zoho access token...");
  const { accessToken, expiresIn, tokenType } = await fetchAccessToken({
    clientId,
    clientSecret,
    refreshToken,
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

  console.log("New access token saved to .env as VITE_ZOHO_ACCESS_TOKEN");
  if (expiresAt) console.log("Token expires at:", expiresAt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
