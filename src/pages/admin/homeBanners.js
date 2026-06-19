import { adminGetDoc, adminPatchDoc } from '../../services/backendApi.js';
import {
  HOME_BANNERS_PATH,
  createEmptyBanner,
  getDefaultHomeBanners,
  moveBanner,
  normalizeBannerList,
} from '../../lib/homeBanners.js';

export {
  HOME_BANNERS_PATH,
  createEmptyBanner,
  getDefaultHomeBanners,
  moveBanner,
  normalizeBannerList,
} from '../../lib/homeBanners.js';

/**
 * @returns {Promise<{ ar: import('../../lib/homeBanners.js').HomeBanner[], en: import('../../lib/homeBanners.js').HomeBanner[] }>}
 */
export async function loadHomeBanners() {
  const snap = await adminGetDoc(HOME_BANNERS_PATH);
  const data = snap && snap.data && typeof snap.data === 'object' ? snap.data : null;

  if (!data) {
    return {
      ar: getDefaultHomeBanners('ar'),
      en: getDefaultHomeBanners('en'),
    };
  }

  const ar = normalizeBannerList(data.ar, 'ar');
  const en = normalizeBannerList(data.en, 'en');

  return {
    ar: ar.length ? ar : getDefaultHomeBanners('ar'),
    en: en.length ? en : getDefaultHomeBanners('en'),
  };
}

/**
 * @param {{ ar: import('../../lib/homeBanners.js').HomeBanner[], en: import('../../lib/homeBanners.js').HomeBanner[] }} payload
 */
export async function saveHomeBanners(payload) {
  const body = {
    ar: normalizeBannerList(payload.ar, 'ar'),
    en: normalizeBannerList(payload.en, 'en'),
    updatedAt: new Date().toISOString(),
  };
  await adminPatchDoc(HOME_BANNERS_PATH, body);
  return body;
}
