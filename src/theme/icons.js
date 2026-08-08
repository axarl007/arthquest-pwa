export const ICON_OPTIONS = [
  'category', 'home', 'shopping_cart', 'shopping_bag', 'directions_car', 'restaurant', 'flight', 'movie', 'spa',
  'fitness_center', 'pets', 'celebration', 'work', 'laptop_mac', 'account_balance_wallet',
  'local_gas_station', 'coffee', 'wifi', 'school', 'child_care', 'medical_services', 'directions_bus', 'local_taxi',
  'local_parking', 'content_cut', 'checkroom', 'tv', 'volunteer_activism', 'local_hospital', 'sports_esports',
  'local_bar', 'cake', 'book', 'credit_card', 'receipt_long',
  'bolt', 'account_balance', 'shield', 'health_and_safety', 'trending_up', 'umbrella', 'savings', 'redeem',
  'key', 'cleaning_services', 'smartphone', 'handyman', 'car_repair', 'interests', 'subscriptions',
  'autorenew', 'real_estate_agent', 'help',
];

export const EMOJI_MAP = {
  home: '🏠', shopping_cart: '🛒', bolt: '⚡', directions_car: '🚗', shield: '🛡️',
  health_and_safety: '💊', account_balance: '🏦', shopping_bag: '🛍️', flight: '✈️',
  restaurant: '🍽️', movie: '🎬', spa: '💆', fitness_center: '🏋️', pets: '🐾',
  celebration: '🎉', apps: '🗂️', trending_up: '📈', umbrella: '☂️', savings: '🐷',
  redeem: '🎁', work: '💼', laptop_mac: '💻', account_balance_wallet: '👛',
  flag: '🚩', category: '🏷️',
  local_gas_station: '⛽', coffee: '☕', wifi: '📶', school: '🎓', child_care: '🍼',
  medical_services: '🩺', directions_bus: '🚌', local_taxi: '🚕', local_parking: '🅿️',
  content_cut: '✂️', checkroom: '👕', tv: '📺', volunteer_activism: '🤝', local_hospital: '🏥',
  sports_esports: '🎮', local_bar: '🍸', cake: '🎂', book: '📚', credit_card: '💳', receipt_long: '🧾',
  key: '🔑', cleaning_services: '🧹', smartphone: '📱', handyman: '🛠️', car_repair: '🔧',
  interests: '🎨', subscriptions: '📺', autorenew: '🔄', real_estate_agent: '🏡', help: '❓',
};

/** In "flat" style this is a Material Symbols glyph name; in "cartoon" style, an emoji. */
export function iconFor(name, style) {
  return style === 'cartoon' ? (EMOJI_MAP[name] || '🏷️') : name;
}

/** Flat style tints the icon's box with the category color; cartoon icons sit on no fill. */
export function iconBoxBg(color, style) {
  return style === 'cartoon' ? 'transparent' : color;
}

/** Cartoon (image) icons render visually smaller than their box at the same px, so scale up. */
export function iconSize(base, style) {
  return Math.round(base * (style === 'cartoon' ? 1.2 : 1.15)) + 'px';
}

/**
 * Local (offline-safe) path to the bundled Twemoji SVG for cartoon style, or null for flat
 * style (which renders via the Material Symbols icon font instead). Assets are copied into
 * public/icons/twemoji/<name>.svg by scripts/copy-twemoji.mjs — one file per EMOJI_MAP key.
 */
export function iconImgUrl(name, style) {
  if (style !== 'cartoon') return null;
  const key = EMOJI_MAP[name] ? name : 'category';
  // BASE_URL is Vite's configured `base` ("/arthquest-pwa/" in production, "/" in dev/test) —
  // a hardcoded leading-slash path would 404 once deployed under the GitHub Pages subpath, since
  // (unlike href/src in index.html) Vite does not rewrite runtime-constructed JS string paths.
  const base = import.meta.env?.BASE_URL ?? '/';
  return `${base}icons/twemoji/${key}.svg`;
}
