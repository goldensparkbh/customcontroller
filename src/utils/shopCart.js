export function readCartCount() {
  try {
    const cart = JSON.parse(localStorage.getItem('ezCart') || '[]');
    if (!Array.isArray(cart)) return 0;
    return cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  } catch {
    return 0;
  }
}

export function addShopDesignToCart(design, { upgrades = [], image, lang = 'en' } = {}) {
  const isAr = lang === 'ar';
  const selected = Array.isArray(upgrades) ? upgrades : [];
  const upgradeTotal = selected.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const unitPrice = Number(design.price || 0) + upgradeTotal;
  const config = {
    Artist: isAr ? design.artistAr : design.artistEn,
    Series: isAr ? design.categoryAr : design.categoryEn
  };
  selected.forEach((item) => {
    config[isAr ? item.nameAr : item.nameEn] = `BHD ${Number(item.price).toFixed(3)}`;
  });

  const cartItem = {
    id: Date.now(),
    name: isAr ? design.nameAr : design.nameEn,
    unitPrice,
    total: unitPrice,
    quantity: 1,
    previewFront: image || design.image,
    config
  };

  const cart = JSON.parse(localStorage.getItem('ezCart') || '[]');
  cart.push(cartItem);
  localStorage.setItem('ezCart', JSON.stringify(cart));
  window.dispatchEvent(new Event('ez-cart-change'));
  return cartItem;
}
