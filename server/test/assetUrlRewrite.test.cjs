"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildSpacesPublicUrl,
  normalizeSpacesPublicUrl
} = require("../lib/spacesPublicUrl.cjs");
const {
  extractFirebaseStorageObjectPath,
  rewriteFirebaseMediaDeep
} = require("../lib/assetUrlRewrite.cjs");

const bucket = "customcontroller";
const cdnBase = "https://customcontroller.fra1.cdn.digitaloceanspaces.com";

test("extracts decoded object keys from Firebase download URLs", () => {
  const url =
    "https://firebasestorage.googleapis.com/v0/b/legacy.appspot.com/o/configurator%2Fshell%20blue%23v2.png?alt=media&token=old";

  assert.equal(
    extractFirebaseStorageObjectPath(url),
    "configurator/shell blue#v2.png"
  );
});

test("rewrites Firebase assets to the migrated folder on the Spaces CDN", () => {
  const payload = {
    icon:
      "https://firebasestorage.googleapis.com/v0/b/legacy.appspot.com/o/icons%2Fshell.png?alt=media",
    nested: [
      {
        image:
          "https://firebasestorage.googleapis.com/v0/b/legacy.appspot.com/o/overlays%2Fblue%20shell.png?alt=media"
      }
    ]
  };

  assert.deepEqual(
    rewriteFirebaseMediaDeep(payload, {
      enabled: true,
      publicBase: cdnBase,
      migratedPrefix: "migrated"
    }),
    {
      icon: `${cdnBase}/migrated/icons/shell.png`,
      nested: [
        {
          image: `${cdnBase}/migrated/overlays/blue%20shell.png`
        }
      ]
    }
  );
});

test("does not duplicate the bucket in virtual-hosted CDN URLs", () => {
  assert.equal(
    buildSpacesPublicUrl("migrated/icons/shell.png", {
      DO_SPACES_BUCKET: bucket,
      DO_SPACES_CDN_BASE_URL: cdnBase
    }),
    `${cdnBase}/migrated/icons/shell.png`
  );
});

test("adds the bucket only for a region-only path-style endpoint", () => {
  assert.equal(
    buildSpacesPublicUrl("migrated/icons/shell.png", {
      DO_SPACES_BUCKET: bucket,
      DO_SPACES_ENDPOINT: "https://fra1.digitaloceanspaces.com"
    }),
    `https://fra1.digitaloceanspaces.com/${bucket}/migrated/icons/shell.png`
  );
});

test("repairs previously generated bucket-prefixed CDN URLs", () => {
  assert.equal(
    normalizeSpacesPublicUrl(
      `${cdnBase}/${bucket}/migrated/icons/shell.png`,
      {
        DO_SPACES_BUCKET: bucket,
        DO_SPACES_CDN_BASE_URL: cdnBase
      }
    ),
    `${cdnBase}/migrated/icons/shell.png`
  );
});
