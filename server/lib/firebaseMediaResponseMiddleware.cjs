"use strict";

const { rewriteFirebaseMediaUrlsIfConfigured } = require("./assetUrlRewrite.cjs");

/**
 * Ensure every JSON API response uses the migrated DigitalOcean asset URLs.
 * This covers commerce/order responses as well as the explicit store/admin APIs.
 */
function firebaseMediaResponseMiddleware(_req, res, next) {
  const sendJson = res.json.bind(res);

  res.json = (payload) => sendJson(rewriteFirebaseMediaUrlsIfConfigured(payload));
  next();
}

module.exports = { firebaseMediaResponseMiddleware };
