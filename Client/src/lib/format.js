import { LOW_STOCK } from './rules.js';

export const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

export const shortDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export const dateTime = (d) =>
  new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const shortId = (id) => String(id).slice(-6).toUpperCase();

export const discountPct = (p) =>
  p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0;

export { LOW_STOCK };

export const STATUS_TONE = {
  'Not Processed': 'neutral',
  Processing: 'info',
  Shipped: 'info',
  Delivered: 'success',
  Cancelled: 'danger',
  Returned: 'warn',
};

// seller shown on products: the store name if set
export const sellerName = (s) => (s ? s.storeName || s.name : 'ShopLane');

export const relativeTime = (d, now = Date.now()) => {
  const s = Math.max(0, Math.round((now - new Date(d).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return shortDate(d);
};
