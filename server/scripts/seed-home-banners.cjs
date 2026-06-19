"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

/*
 * Seeds homepage carousel banners (Arabic + English) into admin_settings/home_banners.
 *
 * Usage (from repo root, with DATABASE_URL set):
 *   node server/scripts/seed-home-banners.cjs
 *   node server/scripts/seed-home-banners.cjs --force
 */

const { Pool } = require("pg");
const { poolOptions } = require("../lib/pgPoolOptions.cjs");
const dao = require("../lib/documentsDao");

const HOME_BANNERS_PATH = "admin_settings/home_banners";

const IMAGE_PATHS = [
  "/assets/home-banners/home-banner-3d-customize.png",
  "/assets/home-banners/home-banner-premade.png",
  "/assets/home-banners/home-banner-checkout.png",
  "/assets/home-banners/home-banner-pro-quality.png",
];

const ACCENTS = ["cyan", "pink", "cyan", "pink"];
const DURATIONS_MS = [5000, 4500, 5500, 4000];

function withDuration(banner, index) {
  return { ...banner, durationMs: DURATIONS_MS[index] || 4500 };
}

const AR_BANNERS = [
  {
    id: "banner_ar_01",
    sortOrder: 0,
    enabled: true,
    eyebrow: "Custom Controller",
    title: "تخصيص حي ثلاثي الأبعاد",
    subtitle: "شاهد كل جزء يتغير فوراً أثناء التصميم",
    imageUrl: IMAGE_PATHS[0],
    accent: ACCENTS[0],
    linkUrl: "/configurator",
    linkLabel: "ابدأ التخصيص",
    linkNewTab: false,
  },
  {
    id: "banner_ar_02",
    sortOrder: 1,
    enabled: true,
    eyebrow: "Custom Controller",
    title: "تصاميم جاهزة بلمسة واحدة",
    subtitle: "انطلق من مجموعة تصاميم حصرية أو ابدأ من الصفر",
    imageUrl: IMAGE_PATHS[1],
    accent: ACCENTS[1],
    linkUrl: "/configurator",
    linkLabel: "استعرض التصاميم",
    linkNewTab: false,
  },
  {
    id: "banner_ar_03",
    sortOrder: 2,
    enabled: true,
    eyebrow: "Custom Controller",
    title: "دفع آمن وتوصيل سريع",
    subtitle: "اطلب اليوم واستلم ذراعك المخصص في وقت قياسي",
    imageUrl: IMAGE_PATHS[2],
    accent: ACCENTS[2],
    linkUrl: "/configurator",
    linkLabel: "اطلب الآن",
    linkNewTab: false,
  },
  {
    id: "banner_ar_04",
    sortOrder: 3,
    enabled: true,
    eyebrow: "Custom Controller",
    title: "جودة احترافية لكل لاعب",
    subtitle: "من الستريمرز إلى فرق الرياضات الإلكترونية",
    imageUrl: IMAGE_PATHS[3],
    accent: ACCENTS[3],
    linkUrl: "#contactSection",
    linkLabel: "تواصل معنا",
    linkNewTab: false,
  },
];

const EN_BANNERS = [
  {
    id: "banner_en_01",
    sortOrder: 0,
    enabled: true,
    eyebrow: "Custom Controller",
    title: "Live 3D customization",
    subtitle: "Watch every part update instantly as you design",
    imageUrl: IMAGE_PATHS[0],
    accent: ACCENTS[0],
    linkUrl: "/configurator",
    linkLabel: "Start customizing",
    linkNewTab: false,
  },
  {
    id: "banner_en_02",
    sortOrder: 1,
    enabled: true,
    eyebrow: "Custom Controller",
    title: "Premade designs in one tap",
    subtitle: "Start from exclusive presets or build from scratch",
    imageUrl: IMAGE_PATHS[1],
    accent: ACCENTS[1],
    linkUrl: "/configurator",
    linkLabel: "Browse designs",
    linkNewTab: false,
  },
  {
    id: "banner_en_03",
    sortOrder: 2,
    enabled: true,
    eyebrow: "Custom Controller",
    title: "Secure checkout, fast delivery",
    subtitle: "Order today and receive your custom controller in no time",
    imageUrl: IMAGE_PATHS[2],
    accent: ACCENTS[2],
    linkUrl: "/configurator",
    linkLabel: "Order now",
    linkNewTab: false,
  },
  {
    id: "banner_en_04",
    sortOrder: 3,
    enabled: true,
    eyebrow: "Custom Controller",
    title: "Pro quality for every player",
    subtitle: "From streamers to esports teams",
    imageUrl: IMAGE_PATHS[3],
    accent: ACCENTS[3],
    linkUrl: "#contactSection",
    linkLabel: "Contact us",
    linkNewTab: false,
  },
];

const force = process.argv.includes("--force");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

(async () => {
  const pool = new Pool(poolOptions(process.env.DATABASE_URL));
  try {
    const existing = await dao.getRow(pool, HOME_BANNERS_PATH);
    if (existing && !force) {
      console.log(
        `Skip: ${HOME_BANNERS_PATH} already exists. Pass --force to replace.`
      );
      return;
    }

    const payload = {
      ar: AR_BANNERS.map(withDuration),
      en: EN_BANNERS.map(withDuration),
      updatedAt: new Date().toISOString(),
      seededAt: new Date().toISOString(),
    };

    await dao.replace(pool, HOME_BANNERS_PATH, payload);

    console.log(`OK seeded ${HOME_BANNERS_PATH}`);
    console.log(`  Arabic banners:  ${AR_BANNERS.length}`);
    console.log(`  English banners: ${EN_BANNERS.length}`);
    AR_BANNERS.forEach((b, i) => {
      console.log(`  [ar ${i + 1}] ${b.title}`);
    });
    EN_BANNERS.forEach((b, i) => {
      console.log(`  [en ${i + 1}] ${b.title}`);
    });
  } finally {
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
