// Mirrors helpers/pricing.js on the server. The server (or demo backend) always recomputes the real totals.
export const SHIPPING_METHODS = {
  standard: { id: 'standard', label: 'Standard', eta: '3-5 business days', cost: 4.99, freeOver: 50 },
  express: { id: 'express', label: 'Express', eta: '1-2 business days', cost: 12.99, freeOver: 0 },
  pickup: { id: 'pickup', label: 'Store pickup', eta: 'Ready in 24 hours', cost: 0, freeOver: 0 },
};

const round2 = (n) => Math.round(n * 100) / 100;

export const shippingCost = (method, subtotal) => {
  const m = SHIPPING_METHODS[method];
  if (!m) return 0;
  return m.freeOver && subtotal >= m.freeOver ? 0 : m.cost;
};

export const evalCoupon = (coupon, subtotal, now = new Date()) => {
  if (!coupon || !coupon.active) return { ok: false, discount: 0, message: 'Invalid coupon code' };
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) return { ok: false, discount: 0, message: 'This coupon has expired' };
  if (coupon.usageLimit && coupon.used >= coupon.usageLimit) return { ok: false, discount: 0, message: 'This coupon has been fully redeemed' };
  if (subtotal < (coupon.minSubtotal || 0))
    return { ok: false, discount: 0, message: `Spend at least $${Number(coupon.minSubtotal).toFixed(2)} to use this coupon` };
  const raw = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
  return { ok: true, discount: round2(Math.min(subtotal, raw)), message: 'Coupon applied' };
};

export const orderTotal = (subtotal, discount, shipping) => round2(Math.max(0, subtotal - discount) + shipping);
