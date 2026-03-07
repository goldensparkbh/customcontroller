import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");
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
    throw new Error(
      "Response missing access_token or refresh_token. Zoho usually only issues a refresh_token when access_type=offline and prompt=consent on the auth URL, and only on first consent per client. Full response: " +
        JSON.stringify(json)
    );
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in_sec || json.expires_in,
    tokenType: json.token_type,
    raw: json,
  };
}

async function main() {
  const envFile = readEnvFile(envPath);
  const clientId = getEnv("ZOHO_CLIENT_ID", envFile);
  const clientSecret = getEnv("ZOHO_CLIENT_SECRET", envFile);
  const code = process.argv[2] || getEnv("ZOHO_AUTH_CODE", envFile);

  if (!clientId || !clientSecret || !code) {
    console.error(
      "Missing required values. Provide auth code as an argument or ZOHO_AUTH_CODE in .env; ensure ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET are set."
    );
    process.exit(1);
  }

  console.log("Exchanging Zoho authorization code for tokens...");
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
  delete nextEnv.ZOHO_AUTH_CODE;

  writeEnvFile(envPath, nextEnv);

  console.log("Tokens saved to .env (VITE_ZOHO_ACCESS_TOKEN, ZOHO_REFRESH_TOKEN).");
  if (expiresAt) console.log("Access token expires at:", expiresAt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
