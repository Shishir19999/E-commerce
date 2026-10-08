// Pricing rules shared by the API and the in-browser live preview (Client/src/lib/pricing.js is a byte-for-byte copy,
// checked by a test). Pure functions with no imports so they are easy to test.
export const SHIPPING_METHODS = {
  standard: { id: "standard", label: "Standard", eta: "3-5 business days", etaDays: [3, 5], cost: 4.99, freeOver: 50 },
  express: { id: "express", label: "Express", eta: "1-2 business days", etaDays: [1, 2], cost: 12.99, freeOver: 0 },
  pickup: { id: "pickup", label: "Store pickup", eta: "Ready in 24 hours", etaDays: [1, 1], cost: 0, freeOver: 0 },
};

// sales tax on (subtotal - discount); the platform keeps COMMISSION_RATE of each seller's sales
export const TAX_RATE = 0.08;
export const COMMISSION_RATE = 0.1;

export const round2 = (n) => Math.round(n * 100) / 100;

// Unknown/absent method -> no shipping charge (keeps the plain API usable without the checkout form)
export const shippingCost = (method, subtotal) => {
  const m = SHIPPING_METHODS[method];
  if (!m) return 0;
  return m.freeOver && subtotal >= m.freeOver ? 0 : m.cost;
};

// Returns { ok, discount, message }
export const evalCoupon = (coupon, subtotal, now = new Date()) => {
  if (!coupon || !coupon.active) return { ok: false, discount: 0, message: "Invalid coupon code" };
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) return { ok: false, discount: 0, message: "This coupon has expired" };
  if (coupon.usageLimit && coupon.used >= coupon.usageLimit) return { ok: false, discount: 0, message: "This coupon has been fully redeemed" };
  if (subtotal < (coupon.minSubtotal || 0))
    return { ok: false, discount: 0, message: `Spend at least $${Number(coupon.minSubtotal).toFixed(2)} to use this coupon` };
  const raw = coupon.type === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  return { ok: true, discount: round2(Math.min(subtotal, raw)), message: "Coupon applied" };
};

export const taxAmount = (subtotal, discount = 0) => round2(Math.max(0, subtotal - discount) * TAX_RATE);

export const orderTotal = (subtotal, discount, shipping, tax = 0) => round2(Math.max(0, subtotal - discount) + shipping + tax);

// what a seller keeps from gross item sales
export const sellerEarnings = (gross) => round2(gross * (1 - COMMISSION_RATE));

// estimated delivery window as [earliest, latest] dates, or null for unknown methods
export const deliveryWindow = (method, from) => {
  const m = SHIPPING_METHODS[method];
  if (!m) return null;
  const d = (n) => new Date(new Date(from).getTime() + n * 86400000);
  return [d(m.etaDays[0]), d(m.etaDays[1])];
};
