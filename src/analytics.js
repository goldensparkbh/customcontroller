/** GA4 measurement ID — keep in sync with gtag snippet in index.html */
export const GA_MEASUREMENT_ID = 'G-WGDL8JNPTZ';

/**
 * Send a page_view for SPA navigations (initial load is handled by gtag config in index.html).
 */
export function gtagPageView(pathname, search = '') {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  const pagePath = `${pathname || '/'}${search || ''}`;
  window.gtag('config', GA_MEASUREMENT_ID, { page_path: pagePath });
}
