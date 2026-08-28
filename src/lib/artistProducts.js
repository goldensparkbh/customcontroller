import { SHOP_CATEGORIES } from '../data/artists.js';

export function slugifyArtistId(value) {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug.slice(0, 80);
}

export function categoryLabels(categoryId) {
  const match = SHOP_CATEGORIES.find((item) => item.id === categoryId);
  return {
    categoryEn: match?.en || 'Premium Series',
    categoryAr: match?.ar || 'السلسلة المميزة'
  };
}

export function mapArtistProductRecord(id, raw = {}) {
  const images = Array.isArray(raw.images) && raw.images.length
    ? raw.images.filter(Boolean)
    : [raw.image].filter(Boolean);
  const category = raw.category && raw.category !== 'all' ? raw.category : 'premium';
  const labels = categoryLabels(category);
  const price = Number(raw.sellPrice != null ? raw.sellPrice : raw.price) || 0;
  const quantity = Number(raw.quantity) || 0;

  return {
    id,
    category,
    price,
    quantity,
    image: images[0] || '',
    gallery: images,
    nameEn: raw.nameEn || raw.name || '',
    nameAr: raw.nameAr || raw.nameEn || raw.name || '',
    artistEn: raw.artistEn || '',
    artistAr: raw.artistAr || raw.artistEn || '',
    categoryEn: raw.categoryEn || labels.categoryEn,
    categoryAr: raw.categoryAr || labels.categoryAr,
    cardEn: raw.cardEn || raw.description || '',
    cardAr: raw.cardAr || raw.cardEn || raw.description || '',
    bioEn: raw.bioEn || '',
    bioAr: raw.bioAr || raw.bioEn || '',
    storyEn: raw.storyEn || '',
    storyAr: raw.storyAr || raw.storyEn || '',
    showOnline: raw.showOnline !== false,
    itemNumber: raw.itemNumber || '',
    barcode: raw.barcode || '',
    inventoryDocPath: `artist_products/${id}`,
    skipBaseController: true,
    productKind: 'artist'
  };
}
