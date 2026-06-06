"use strict";

const dao = require("./documentsDao");

const DEFAULT_MESSAGE_AR =
  "الموقع قيد الصيانة حالياً. نعمل على تحسين تجربتكم وسنعود قريباً. شكراً لصبركم.";
const DEFAULT_MESSAGE_EN =
  "This website is under maintenance. We are improving your experience and will be back soon. Thank you for your patience.";

const CACHE_MS = Number(process.env.MAINTENANCE_CACHE_MS || 5000);

/** @type {{ at: number, value: { maintenanceMode: boolean, messageAr: string, messageEn: string } | null }} */
const cache = { at: 0, value: null };

function hasAdminSession(req) {
  const raw = req.signedCookies && req.signedCookies.ezadm;
  if (!raw) return false;
  try {
    const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Boolean(payload && payload.uid);
  } catch {
    return false;
  }
}

function isExemptPath(urlPath) {
  if (urlPath === "/health") return true;
  if (urlPath.startsWith("/admin-api")) return true;
  if (urlPath === "/store-api/site/status") return true;
  if (urlPath === "/store-api/exchange-rates") return true;
  if (urlPath === "/store-api/geo/currency") return true;
  return false;
}

async function getMaintenanceStatus(pool) {
  const now = Date.now();
  if (cache.value && now - cache.at < CACHE_MS) return cache.value;

  const row = await dao.getRow(pool, "admin_settings/general");
  const data = row && row.data ? row.data : {};

  const value = {
    maintenanceMode: Boolean(data.maintenanceMode),
    messageAr: String(data.maintenanceMessageAr || "").trim() || DEFAULT_MESSAGE_AR,
    messageEn: String(data.maintenanceMessageEn || "").trim() || DEFAULT_MESSAGE_EN
  };

  cache.value = value;
  cache.at = now;
  return value;
}

function invalidateMaintenanceCache() {
  cache.at = 0;
  cache.value = null;
}

function createMaintenanceMiddleware(pool) {
  return async function maintenanceMiddleware(req, res, next) {
    try {
      const urlPath = req.originalUrl.split("?")[0];
      if (isExemptPath(urlPath)) return next();
      if (hasAdminSession(req)) return next();

      const status = await getMaintenanceStatus(pool);
      if (!status.maintenanceMode) return next();

      return res.status(503).json({
        error: "maintenance",
        maintenanceMode: true,
        messageAr: status.messageAr,
        messageEn: status.messageEn
      });
    } catch (err) {
      console.error("[maintenance]", err);
      return next();
    }
  };
}

module.exports = {
  DEFAULT_MESSAGE_AR,
  DEFAULT_MESSAGE_EN,
  getMaintenanceStatus,
  createMaintenanceMiddleware,
  invalidateMaintenanceCache,
  hasAdminSession
};
