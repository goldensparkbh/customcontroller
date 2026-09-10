import React from 'react';

export function stockTone(qty, lowThreshold = 5) {
  const n = Number(qty) || 0;
  if (n <= 0) return 'danger';
  if (n <= lowThreshold) return 'warning';
  return 'ok';
}

const AdminStockBadge = ({ qty, lang = 'ar', lowThreshold = 5, showCount = true }) => {
  const isAr = lang === 'ar';
  const n = Number(qty) || 0;
  const tone = stockTone(n, lowThreshold);
  let label;
  if (n <= 0) label = isAr ? 'نفد' : 'Out of stock';
  else if (n <= lowThreshold) label = showCount ? (isAr ? `منخفض · ${n}` : `Low · ${n}`) : (isAr ? 'منخفض' : 'Low');
  else label = showCount ? (isAr ? `متوفر · ${n}` : `In stock · ${n}`) : (isAr ? 'متوفر' : 'In stock');

  return <span className={`admin-badge admin-badge--${tone}`}>{label}</span>;
};

export default AdminStockBadge;
