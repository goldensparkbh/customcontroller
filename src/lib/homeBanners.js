import { getI18nDefaultSource } from '../i18n.js';

export const HOME_BANNERS_PATH = 'admin_settings/home_banners';

/** @typedef {'cyan' | 'pink'} HomeBannerAccent */

/**
 * @typedef {Object} HomeBanner
 * @property {string} id
 * @property {number} sortOrder
 * @property {boolean} enabled
 * @property {string} eyebrow
 * @property {string} title
 * @property {string} subtitle
 * @property {string} imageUrl
 * @property {HomeBannerAccent} accent
 * @property {string} linkUrl
 * @property {string} linkLabel
 * @property {boolean} linkNewTab
 */

/**
 * @param {string} prefix
 * @param {number} index
 */
function makeId(prefix, index) {
  return `${prefix}_${index}_${Date.now().toString(36)}`;
}

/**
 * @param {'ar' | 'en'} lang
 * @returns {HomeBanner[]}
 */
export function getDefaultHomeBanners(lang) {
  const dict = getI18nDefaultSource()[lang] || {};
  const accentCycle = /** @type {HomeBannerAccent[]} */ (['cyan', 'pink', 'cyan', 'pink']);
  const imagePaths = [
    '/assets/home-banners/home-banner-3d-customize.png',
    '/assets/home-banners/home-banner-premade.png',
    '/assets/home-banners/home-banner-checkout.png',
    '/assets/home-banners/home-banner-pro-quality.png',
  ];
  const linkMeta = lang === 'ar'
    ? [
        { linkUrl: '/configurator', linkLabel: 'ابدأ التخصيص' },
        { linkUrl: '/configurator', linkLabel: 'استعرض التصاميم' },
        { linkUrl: '/configurator', linkLabel: 'اطلب الآن' },
        { linkUrl: '#contactSection', linkLabel: 'تواصل معنا' },
      ]
    : [
        { linkUrl: '/configurator', linkLabel: 'Start customizing' },
        { linkUrl: '/configurator', linkLabel: 'Browse designs' },
        { linkUrl: '/configurator', linkLabel: 'Order now' },
        { linkUrl: '#contactSection', linkLabel: 'Contact us' },
      ];
  const keys = [
    ['homeBanner1Title', 'homeBanner1Sub'],
    ['homeBanner2Title', 'homeBanner2Sub'],
    ['homeBanner3Title', 'homeBanner3Sub'],
    ['homeBanner4Title', 'homeBanner4Sub'],
  ];

  return keys.map(([titleKey, subKey], index) => ({
    id: makeId('default', index),
    sortOrder: index,
    enabled: true,
    eyebrow: 'Custom Controller',
    title: dict[titleKey] || '',
    subtitle: dict[subKey] || '',
    imageUrl: imagePaths[index] || '',
    accent: accentCycle[index] || 'cyan',
    linkUrl: linkMeta[index]?.linkUrl || '',
    linkLabel: linkMeta[index]?.linkLabel || '',
    linkNewTab: false,
  }));
}

/**
 * @param {unknown} value
 * @returns {HomeBannerAccent}
 */
function normalizeAccent(value) {
  return value === 'pink' ? 'pink' : 'cyan';
}

/**
 * @param {unknown} row
 * @param {number} index
 * @param {'ar' | 'en'} lang
 * @returns {HomeBanner}
 */
function normalizeBanner(row, index, lang) {
  const fallback = getDefaultHomeBanners(lang)[index] || getDefaultHomeBanners(lang)[0];
  const src = row && typeof row === 'object' ? row : {};
  return {
    id: typeof src.id === 'string' && src.id ? src.id : makeId('banner', index),
    sortOrder: Number.isFinite(Number(src.sortOrder)) ? Number(src.sortOrder) : index,
    enabled: src.enabled !== false,
    eyebrow: typeof src.eyebrow === 'string' ? src.eyebrow : fallback.eyebrow,
    title: typeof src.title === 'string' ? src.title : fallback.title,
    subtitle: typeof src.subtitle === 'string' ? src.subtitle : fallback.subtitle,
    imageUrl: typeof src.imageUrl === 'string' ? src.imageUrl : '',
    accent: normalizeAccent(src.accent),
    linkUrl: typeof src.linkUrl === 'string' ? src.linkUrl : '',
    linkLabel: typeof src.linkLabel === 'string' ? src.linkLabel : '',
    linkNewTab: src.linkNewTab === true,
  };
}

/**
 * @param {unknown} list
 * @param {'ar' | 'en'} lang
 * @returns {HomeBanner[]}
 */
export function normalizeBannerList(list, lang) {
  const arr = Array.isArray(list) ? list : [];
  const normalized = arr.map((row, index) => normalizeBanner(row, index, lang));
  normalized.sort((a, b) => a.sortOrder - b.sortOrder || String(a.id).localeCompare(String(b.id)));
  return normalized.map((row, index) => ({ ...row, sortOrder: index }));
}

/**
 * @param {HomeBanner[]} list
 * @param {number} index
 * @param {number} delta
 * @returns {HomeBanner[]}
 */
export function moveBanner(list, index, delta) {
  const next = [...list];
  const target = index + delta;
  if (target < 0 || target >= next.length) return next;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next.map((row, i) => ({ ...row, sortOrder: i }));
}

/**
 * @param {HomeBanner[]} list
 * @param {'ar' | 'en'} lang
 * @returns {HomeBanner}
 */
export function createEmptyBanner(list, lang) {
  const isAr = lang === 'ar';
  return {
    id: makeId('banner', list.length),
    sortOrder: list.length,
    enabled: true,
    eyebrow: 'Custom Controller',
    title: isAr ? 'عنوان البانر' : 'Banner title',
    subtitle: isAr ? 'وصف قصير للبانر' : 'Short banner description',
    imageUrl: '',
    accent: list.length % 2 === 0 ? 'cyan' : 'pink',
    linkUrl: '',
    linkLabel: '',
    linkNewTab: false,
  };
}
