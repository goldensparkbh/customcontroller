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
  let snap = null;
  try {
    snap = await adminGetDoc(HOME_BANNERS_PATH);
  } catch {
    snap = null;
  }

  const data = snap && typeof snap === 'object' ? snap : {};
  const nested = data.data && typeof data.data === 'object' ? data.data : data;
  const hasSavedLists = Array.isArray(nested.ar) || Array.isArray(nested.en);

  if (!hasSavedLists) {
    return {
      ar: getDefaultHomeBanners('ar'),
      en: getDefaultHomeBanners('en'),
    };
  }

  const ar = normalizeBannerList(nested.ar, 'ar');
  const en = normalizeBannerList(nested.en, 'en');

  return { ar, en };
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
