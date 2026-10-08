// Pure report builders shared by the API and the in-browser live preview (Client/src/lib/reports.js is a
// byte-for-byte copy, checked by a test). Inputs are plain objects (lean documents); no imports on purpose.
const DAY = 86400000;
const r2 = (n) => Math.round(n * 100) / 100;
const iso = (d) => new Date(d).toISOString();
const id = (v) => (v && typeof v === "object" && v._id ? String(v._id) : v == null ? "" : String(v));
const COMMISSION = 0.1;

const dayKeys = (now, days) => {
  const since = new Date(now - (days - 1) * DAY);
  since.setUTCHours(0, 0, 0, 0);
  return { since: since.getTime(), keys: Array.from({ length: days }, (_, i) => iso(since.getTime() + i * DAY).slice(0, 10)) };
};

const live = (o) => o.status !== "Cancelled" && o.status !== "Returned";

// Seller dashboard numbers: only the seller's own item lines count.
export const buildSellerStats = ({ orders, products, sellerId, now = Date.now(), days = 14, lowStock = 10 }) => {
  const me = String(sellerId);
  const { since, keys } = dayKeys(now, days);
  const mine = (o) => (o.items || []).filter((i) => id(i.seller) === me);
  const sellable = orders.filter((o) => mine(o).length && live(o));
  const gross = (o) => mine(o).reduce((s, i) => s + i.price * i.quantity, 0);
  const grossAll = r2(sellable.reduce((s, o) => s + gross(o), 0));
  const series = keys.map((date) => {
    const day = sellable.filter((o) => iso(o.createdAt).slice(0, 10) === date);
    return { date, revenue: r2(day.reduce((s, o) => s + gross(o), 0)), orders: day.length };
  });
  const per = new Map();
  for (const o of sellable)
    for (const i of mine(o)) {
      const k = id(i.product);
      const cur = per.get(k) || { _id: k, name: i.name, sold: 0, revenue: 0 };
      cur.sold += i.quantity;
      cur.revenue = r2(cur.revenue + i.price * i.quantity);
      per.set(k, cur);
    }
  const byStatus = {};
  for (const o of orders) if (mine(o).length) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  const pending = orders.filter((o) => mine(o).length && ["Not Processed", "Processing"].includes(o.status)).length;
  const inWindow = sellable.filter((o) => new Date(o.createdAt).getTime() >= since);
  return {
    gross: grossAll,
    earnings: r2(grossAll * (1 - COMMISSION)),
    commission: r2(grossAll * COMMISSION),
    orders: sellable.length,
    units: sellable.reduce((s, o) => s + mine(o).reduce((n, i) => n + i.quantity, 0), 0),
    pending,
    periodRevenue: r2(inWindow.reduce((s, o) => s + gross(o), 0)),
    products: products.length,
    lowStockThreshold: lowStock,
    ordersByStatus: byStatus,
    series,
    lowStock: products
      .filter((p) => p.quantity <= lowStock)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 10)
      .map((p) => ({ _id: id(p._id), name: p.name, slug: p.slug, quantity: p.quantity, photo: p.photo })),
    topProducts: [...per.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
  };
};

// Admin report for the last `days` days (cancelled / returned orders are excluded from sales).
export const buildReport = ({ orders, products, categories, users = [], now = Date.now(), days = 30 }) => {
  const { since, keys } = dayKeys(now, days);
  const inRange = orders.filter((o) => new Date(o.createdAt).getTime() >= since);
  const sales = inRange.filter(live);
  const pById = new Map(products.map((p) => [id(p._id), p]));
  const cById = new Map(categories.map((c) => [id(c._id), c]));
  const uById = new Map(users.map((u) => [id(u._id), u]));
  const revenue = r2(sales.reduce((s, o) => s + o.total, 0));
  const cat = new Map();
  const prod = new Map();
  const sel = new Map();
  for (const o of sales)
    for (const i of o.items) {
      const p = pById.get(id(i.product));
      const c = p ? cById.get(id(p.category)) : null;
      const ck = c ? id(c._id) : "gone";
      const cc = cat.get(ck) || { name: c ? c.name : "Other", revenue: 0, units: 0 };
      cc.revenue = r2(cc.revenue + i.price * i.quantity);
      cc.units += i.quantity;
      cat.set(ck, cc);
      const pk = id(i.product);
      const pp = prod.get(pk) || { _id: pk, name: i.name, revenue: 0, units: 0 };
      pp.revenue = r2(pp.revenue + i.price * i.quantity);
      pp.units += i.quantity;
      prod.set(pk, pp);
      const sk = id(i.seller) || "store";
      const su = uById.get(sk);
      const ss = sel.get(sk) || { _id: sk, name: sk === "store" ? "ShopLane (store)" : su ? su.storeName || su.name : "Seller", revenue: 0, units: 0 };
      ss.revenue = r2(ss.revenue + i.price * i.quantity);
      ss.units += i.quantity;
      sel.set(sk, ss);
    }
  const coupons = new Map();
  for (const o of sales)
    if (o.couponCode) {
      const cu = coupons.get(o.couponCode) || { code: o.couponCode, orders: 0, discount: 0 };
      cu.orders += 1;
      cu.discount = r2(cu.discount + (o.discount || 0));
      coupons.set(o.couponCode, cu);
    }
  const series = keys.map((date) => {
    const day = sales.filter((o) => iso(o.createdAt).slice(0, 10) === date);
    return { date, revenue: r2(day.reduce((s, o) => s + o.total, 0)), orders: day.length };
  });
  const by = (m, k = "revenue") => [...m.values()].sort((a, b) => b[k] - a[k]);
  return {
    days,
    summary: {
      revenue,
      orders: sales.length,
      averageOrder: sales.length ? r2(revenue / sales.length) : 0,
      units: sales.reduce((s, o) => s + o.items.reduce((n, i) => n + i.quantity, 0), 0),
      tax: r2(sales.reduce((s, o) => s + (o.tax || 0), 0)),
      shipping: r2(sales.reduce((s, o) => s + (o.shipping || 0), 0)),
      discounts: r2(sales.reduce((s, o) => s + (o.discount || 0), 0)),
      cancelled: inRange.filter((o) => o.status === "Cancelled").length,
      returned: inRange.filter((o) => o.status === "Returned").length,
      returnRequests: inRange.filter((o) => o.returnRequest && o.returnRequest.status === "requested").length,
    },
    series,
    byCategory: by(cat),
    topProducts: by(prod).slice(0, 8),
    bySeller: by(sel),
    coupons: by(coupons, "orders"),
  };
};
