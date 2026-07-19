"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildSpacesPublicUrl,
  normalizeSpacesPublicUrl
} = require("../lib/spacesPublicUrl.cjs");
const {
  hasSpacesPublicTarget,
  extractFirebaseStorageObjectPath,
  rewriteFirebaseMediaDeep,
  rewriteFirebaseMediaUrlsIfConfigured
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

test("supports the exact firebasestorage.app bucket URL format", () => {
  const url =
    "https://firebasestorage.googleapis.com/v0/b/ps5-controller.firebasestorage.app/o/configurator%2Ficons%2Fbackshell_1773953578007?alt=media&token=6003ff36-fa73-4b0d-b34f-a08fc211e765";

  assert.equal(
    extractFirebaseStorageObjectPath(url),
    "configurator/icons/backshell_1773953578007"
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

test("dedicated migrated asset base activates rewriting without other Spaces settings", () => {
  const previous = {
    MIGRATED_ASSETS_PUBLIC_BASE_URL: process.env.MIGRATED_ASSETS_PUBLIC_BASE_URL,
    DO_SPACES_PUBLIC_BASE_URL: process.env.DO_SPACES_PUBLIC_BASE_URL,
    DO_SPACES_CDN_BASE_URL: process.env.DO_SPACES_CDN_BASE_URL,
    DO_SPACES_ENDPOINT: process.env.DO_SPACES_ENDPOINT,
    DO_SPACES_BUCKET: process.env.DO_SPACES_BUCKET
  };

  try {
    delete process.env.DO_SPACES_PUBLIC_BASE_URL;
    delete process.env.DO_SPACES_CDN_BASE_URL;
    delete process.env.DO_SPACES_ENDPOINT;
    delete process.env.DO_SPACES_BUCKET;
    process.env.MIGRATED_ASSETS_PUBLIC_BASE_URL = cdnBase;

    assert.equal(hasSpacesPublicTarget(process.env), true);
    assert.deepEqual(
      rewriteFirebaseMediaUrlsIfConfigured({
        image:
          "https://firebasestorage.googleapis.com/v0/b/ps5-controller.firebasestorage.app/o/configurator%2Ficons%2Fbackshell.png?alt=media"
      }),
      {
        image: `${cdnBase}/migrated/configurator/icons/backshell.png`
      }
    );
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
