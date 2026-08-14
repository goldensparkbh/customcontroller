import React from 'react';
import { useCurrency } from '../context/CurrencyContext.jsx';

export default function ShopPrice({ amountBhd, className = '', split = true }) {
  const { formatFromBhd, currency } = useCurrency();
  const formatted = formatFromBhd(amountBhd);

  if (!split) {
    return <span className={`shop-price ${className}`.trim()}>{formatted}</span>;
  }

  if (currency === 'USD' && formatted.startsWith('$')) {
    return (
      <span className={`shop-price ${className}`.trim()}>
        <em>$</em>
        <strong>{formatted.slice(1)}</strong>
      </span>
    );
  }

  const parts = formatted.trim().split(/\s+/);
  const code = parts.find((part) => /^[A-Z]{3}$/.test(part)) || currency;
  const number = parts.find((part) => /[0-9]/.test(part)) || formatted;

  return (
    <span className={`shop-price ${className}`.trim()}>
      <em>{code}</em>
      <strong>{number}</strong>
    </span>
  );
}
