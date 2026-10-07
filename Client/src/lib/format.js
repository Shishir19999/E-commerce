export const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

export const shortDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export const dateTime = (d) =>
  new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const shortId = (id) => String(id).slice(-6).toUpperCase();

export const discountPct = (p) =>
  p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0;

export const LOW_STOCK = 10;

export const STATUS_TONE = {
  'Not Processed': 'neutral',
  Processing: 'info',
  Shipped: 'info',
  Delivered: 'success',
  Cancelled: 'danger',
};
