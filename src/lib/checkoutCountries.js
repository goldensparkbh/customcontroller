export const CHECKOUT_COUNTRY_CODES = ['BH', 'SA', 'AE', 'KW', 'OM', 'QA', 'EG', 'JO'];

export const CHECKOUT_COUNTRY_PHONE_PREFIX = {
  BH: '973',
  SA: '966',
  AE: '971',
  KW: '965',
  OM: '968',
  QA: '974',
  EG: '20',
  JO: '962'
};

export function getCheckoutPhonePrefix(countryCode) {
  return CHECKOUT_COUNTRY_PHONE_PREFIX[countryCode] || '973';
}
