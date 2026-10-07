// In-browser demo backend. Exposes the same REST-style surface as the Express API (same paths, same
// response shapes, same validation rules) on top of localStorage, so the UI code is identical in both modes.
// No DOM or import.meta usage at module level so it can be unit tested in Node.
import { buildSeed, recalcRating, slugify } from './seed.js';
import { SHIPPING_METHODS, evalCoupon, orderTotal, shippingCost } from '../lib/pricing.js';

export const DB_KEY = 'ecom_demo_db_v1';
export const LOW_STOCK_THRESHOLD = 10;
const DAY = 86400000;
const STATUSES = ['Not Processed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_UPLOAD = 250 * 1024; // keeps localStorage small

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (message, status = 400) => new HttpError(status, message);

export const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) };
};

export const browserStorage = () => {
  try {
    const s = globalThis.localStorage;
    s.setItem('__t', '1');
    s.removeItem('__t');
    return s;
  } catch {
    return memoryStorage(); // storage blocked (private mode): the demo still works for this tab
  }
};

const sha256 = async (text) => {
  try {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`demo-salt:${text}`));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 5381; // insecure fallback for non-secure contexts; fine for demo data that never leaves the browser
    for (const ch of `demo-salt:${text}`) h = (Math.imul(h, 33) + ch.charCodeAt(0)) | 0;
    return `x${h >>> 0}`;
  }
};

const newId = () => {
  let s = '';
  while (s.length < 24) s += Math.floor(Math.random() * 16).toString(16);
  return s;
};

const isStr = (v, min = 1, max = 200) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
const toNum = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
const round2 = (n) => Math.round(n * 100) / 100;
const isHttpUrl = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};
const okPhoto = (v) => typeof v === 'string' && v.length <= 400000 && (isHttpUrl(v) || v.startsWith('art:') || v.startsWith('data:image/'));

const readFile = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(bad('Could not read the image'));
    r.readAsDataURL(file);
  });

const normalizeBody = async (data) => {
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    const o = {};
    for (const [k, v] of data.entries()) {
      if (typeof v === 'string') o[k] = v;
      else if (v && v.size) {
        if (v.size > MAX_UPLOAD) throw bad('In the demo, uploads must be 250 KB or smaller');
        if (!/^image\/(jpeg|png|webp|gif)$/.test(v.type)) throw bad('Only jpg, png, webp or gif images are allowed');
        o[k] = await readFile(v);
      }
    }
    return o;
  }
  return data && typeof data === 'object' ? data : {};
};

const parseJson = (v, fallback) => {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string' || v === '') return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

export function createDemoApi({ storage = browserStorage(), latency = [140, 420], now = () => Date.now() } = {}) {
  // ---------- persistence ----------
  let seedPromise = null;
  const seed = async () => {
    const hash = await sha256('Password123!');
    storage.setItem(DB_KEY, JSON.stringify(buildSeed(hash, now())));
  };
  const ensureSeed = async () => {
    if (!seedPromise) {
      seedPromise = (async () => {
        let ok;
        try {
          ok = JSON.parse(storage.getItem(DB_KEY) || 'null')?.version === 1;
        } catch {
          ok = false;
        }
        if (!ok) await seed();
      })();
    }
    return seedPromise;
  };
  const load = () => JSON.parse(storage.getItem(DB_KEY));
  const save = (db) => storage.setItem(DB_KEY, JSON.stringify(db));

  const resetDemo = async () => {
    storage.removeItem(DB_KEY);
    seedPromise = null;
    await ensureSeed();
  };

  // ---------- auth ----------
  const makeToken = (u) => `demo.${btoa(JSON.stringify({ id: u._id, tv: u.tokenVersion || 0, exp: now() + 7 * DAY }))}`;
  const readToken = () => {
    try {
      return JSON.parse(storage.getItem('auth') || 'null')?.token || '';
    } catch {
      return '';
    }
  };
  const userFromToken = (db, token) => {
    if (!token) throw bad('Token missing, authorization denied', 401);
    let p;
    try {
      p = JSON.parse(atob(token.replace(/^demo\./, '')));
    } catch {
      throw bad('Invalid or expired token', 401);
    }
    if (!p?.id || p.exp < now()) throw bad('Invalid or expired token', 401);
    const u = db.users.find((x) => x._id === p.id);
    if (!u) throw bad('User no longer exists', 401);
    if ((p.tv || 0) !== (u.tokenVersion || 0)) throw bad('Token has been revoked, please log in again', 401);
    return u;
  };
  const publicUser = (u) => ({ _id: u._id, name: u.name, email: u.email, phone: u.phone, address: u.address, role: u.role });
  const adminUser = (u) => ({ ...publicUser(u), createdAt: u.createdAt });

  // ---------- shaping ----------
  const withCategory = (db, p) => {
    const c = db.categories.find((x) => x._id === p.category);
    return { ...p, category: c ? { _id: c._id, name: c.name, slug: c.slug } : null };
  };
  const uniqueSlug = (db, name, excludeId) => {
    const base = slugify(name) || 'product';
    let slug = base;
    for (let i = 2; db.products.some((p) => p.slug === slug && p._id !== excludeId); i++) slug = `${base}-${i}`;
    return slug;
  };

  // ---------- products ----------
  const parseProduct = (db, body, partial) => {
    const d = {};
    const has = (k) => body[k] !== undefined;
    if (!partial || has('name')) {
      if (!isStr(body.name, 1, 120)) throw bad('Name is required (max 120 chars)');
      d.name = body.name.trim();
    }
    if (!partial || has('description')) {
      if (!isStr(body.description, 1, 2000)) throw bad('Description is required (max 2000 chars)');
      d.description = body.description.trim();
    }
    if (!partial || has('price')) {
      const p = toNum(body.price);
      if (!Number.isFinite(p) || p < 0 || p > 1e9) throw bad('Price must be a number >= 0');
      d.price = round2(p);
    }
    if (!partial || has('quantity')) {
      const q = toNum(body.quantity);
      if (!Number.isInteger(q) || q < 0 || q > 1e7) throw bad('Quantity must be an integer >= 0');
      d.quantity = q;
    }
    if (!partial || has('category')) {
      if (!db.categories.some((c) => c._id === body.category)) throw bad('A valid category id is required');
      d.category = body.category;
    }
    if (has('compareAtPrice') || !partial) {
      const c = body.compareAtPrice === undefined || body.compareAtPrice === '' ? 0 : toNum(body.compareAtPrice);
      if (!Number.isFinite(c) || c < 0 || c > 1e9) throw bad('Compare-at price must be a number >= 0');
      d.compareAtPrice = round2(c);
    }
    if (has('featured')) d.featured = body.featured === true || body.featured === 'true';
    if (has('images')) {
      const imgs = parseJson(body.images, []);
      if (!Array.isArray(imgs) || imgs.length > 8 || !imgs.every(okPhoto)) throw bad('Images must be a list of up to 8 http(s) URLs');
      d.images = imgs;
    }
    if (has('variants')) {
      const v = parseJson(body.variants, []);
      const okOpt = (o) => Array.isArray(o) && o.length > 0 && o.length <= 12 && o.every((x) => isStr(x, 1, 30));
      if (!Array.isArray(v) || v.length > 4 || !v.every((x) => x && isStr(x.name, 1, 30) && okOpt(x.options)))
        throw bad('Variants must be up to 4 groups, each with a name and 1-12 options');
      d.variants = v.map((x) => ({ name: x.name.trim(), options: x.options.map((o) => o.trim()) }));
    }
    if (has('photo')) {
      if (body.photo === '') d.photo = '';
      else if (okPhoto(body.photo)) d.photo = body.photo;
      else throw bad('Photo must be an http(s) URL or an uploaded image');
    }
    return d;
  };

  const listProducts = (db, q) => {
    const page = Math.max(1, Number.parseInt(q.page) || 1);
    const limit = Math.min(60, Math.max(1, Number.parseInt(q.limit) || 12));
    let list = db.products;
    if (q.search) {
      const s = String(q.search).slice(0, 100).toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s));
    }
    if (q.category) {
      const c = String(q.category);
      const cat = db.categories.find((x) => x._id === c || x.slug === c.toLowerCase());
      list = list.filter((p) => cat && p.category === cat._id);
    }
    const min = toNum(q.minPrice);
    const max = toNum(q.maxPrice);
    if (Number.isFinite(min)) list = list.filter((p) => p.price >= min);
    if (Number.isFinite(max)) list = list.filter((p) => p.price <= max);
    const minRating = toNum(q.minRating);
    if (Number.isFinite(minRating) && minRating > 0) list = list.filter((p) => p.rating >= minRating);
    if (String(q.inStock) === 'true') list = list.filter((p) => p.quantity > 0);
    if (String(q.featured) === 'true') list = list.filter((p) => p.featured);
    if (q.ids) {
      const ids = new Set(String(q.ids).split(','));
      list = list.filter((p) => ids.has(p._id));
    }
    const sorts = {
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      price_asc: (a, b) => a.price - b.price,
      price_desc: (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating || b.numReviews - a.numReviews,
      popular: (a, b) => b.sold - a.sold,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    const sorted = [...list].sort(sorts[q.sort] || sorts.newest);
    const total = sorted.length;
    const top = db.products.reduce((m, p) => Math.max(m, p.price), 0);
    return {
      success: true,
      message: 'Products fetched',
      products: sorted.slice((page - 1) * limit, page * limit).map((p) => withCategory(db, p)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      maxPrice: Math.ceil(top),
    };
  };

  // ---------- orders ----------
  const stamp = (order, status, note) => {
    order.status = status;
    order.timeline.push({ status, note: String(note || '').slice(0, 200), at: new Date(now()).toISOString() });
    order.updatedAt = new Date(now()).toISOString();
  };
  const restock = (db, order) =>
    order.items.forEach((it) => {
      const p = db.products.find((x) => x._id === it.product);
      if (p) {
        p.quantity += it.quantity;
        p.sold = Math.max(0, p.sold - it.quantity);
      }
    });

  const placeOrder = (db, user, body) => {
    const { items, shippingAddress, shippingMethod, couponCode } = body;
    if (!isStr(shippingAddress, 5, 300)) throw bad('Shipping address is required (5-300 chars)');
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) throw bad('Cart must contain 1-50 items');
    const merged = new Map();
    for (const it of items) {
      if (!it || typeof it.product !== 'string') throw bad('Each item needs a valid product id');
      const q = Number(it.quantity);
      if (!Number.isInteger(q) || q < 1 || q > 100) throw bad('Item quantity must be an integer between 1 and 100');
      if (it.variant !== undefined && it.variant !== '' && !isStr(it.variant, 1, 80)) throw bad('Invalid variant selection');
      const key = `${it.product}|${it.variant || ''}`;
      const prev = merged.get(key);
      merged.set(key, { product: it.product, variant: it.variant || '', qty: (prev?.qty || 0) + q });
    }
    // all-or-nothing: check stock first (a product may appear on several variant lines)
    const need = new Map();
    for (const m of merged.values()) need.set(m.product, (need.get(m.product) || 0) + m.qty);
    for (const [pid, qty] of need) {
      const p = db.products.find((x) => x._id === pid);
      if (!p) throw bad('A product in your cart no longer exists', 409);
      if (p.quantity < qty) throw bad(`Not enough stock for "${p.name}"`, 409);
    }
    if (shippingMethod !== undefined && shippingMethod !== '' && !SHIPPING_METHODS[shippingMethod]) throw bad('Unknown shipping method');
    const lines = [...merged.values()].map((m) => {
      const p = db.products.find((x) => x._id === m.product);
      return { product: p._id, name: p.name, price: p.price, quantity: m.qty, variant: m.variant, photo: p.photo || '' };
    });
    const subtotal = round2(lines.reduce((s, l) => s + l.price * l.quantity, 0));
    let discount = 0;
    let code = '';
    let coupon = null;
    if (couponCode !== undefined && couponCode !== null && couponCode !== '') {
      if (typeof couponCode !== 'string') throw bad('Invalid coupon code');
      coupon = db.coupons.find((c) => c.code === couponCode.trim().toUpperCase());
      const r = evalCoupon(coupon, subtotal, new Date(now()));
      if (!r.ok) throw bad(r.message);
      discount = r.discount;
      code = coupon.code;
    }
    const shipping = shippingCost(shippingMethod, subtotal - discount);
    for (const [pid, qty] of need) {
      const p = db.products.find((x) => x._id === pid);
      p.quantity -= qty;
      p.sold += qty;
    }
    if (coupon) coupon.used += 1;
    const ts = new Date(now()).toISOString();
    const order = {
      _id: newId(),
      user: user._id,
      items: lines,
      subtotal,
      discount,
      shipping,
      couponCode: code,
      shippingMethod: shippingMethod || '',
      total: orderTotal(subtotal, discount, shipping),
      shippingAddress: shippingAddress.trim(),
      status: 'Not Processed',
      timeline: [{ status: 'Not Processed', note: 'Order placed', at: ts }],
      payment: { method: 'mock', status: 'paid (mock)' },
      createdAt: ts,
      updatedAt: ts,
    };
    db.orders.push(order);
    return order;
  };

  const orderOut = (db, o, populateUser) => {
    if (!populateUser) return o;
    const u = db.users.find((x) => x._id === o.user);
    return { ...o, user: u ? { _id: u._id, name: u.name, email: u.email } : null };
  };

  // ---------- routes ----------
  const routes = [];
  const add = (method, path, handler) => {
    const keys = [];
    const re = new RegExp('^' + path.replace(/:[a-zA-Z]+/g, (m) => (keys.push(m.slice(1)), '([^/]+)')) + '/?$');
    routes.push({ method, re, keys, handler });
  };
  const ok = (data, status = 200) => ({ status, data: { success: true, ...data } });
  const ctxUser = (c) => userFromToken(c.db, c.token);
  const ctxAdmin = (c) => {
    const u = ctxUser(c);
    if (u.role !== 1) throw bad('Unauthorized Access', 401);
    return u;
  };
  const V = '/api/v1';

  // auth
  add('POST', `${V}/auth/register`, async (c) => {
    const { name, email, password, phone, address } = c.body;
    if (!isStr(name, 1, 100)) throw bad('Name is Required');
    if (!isStr(email, 3, 200) || !EMAIL_RE.test(email.trim())) throw bad('A valid email is Required');
    if (typeof password !== 'string' || password.length < 6 || password.length > 100) throw bad('Password is required (6-100 chars)');
    if (!isStr(phone, 1, 30)) throw bad('phone no is Required');
    if (!isStr(address, 1, 300)) throw bad('address is Required');
    const clean = email.trim().toLowerCase();
    if (c.db.users.some((u) => u.email === clean)) throw bad('Already Register Please Login', 409);
    const user = { _id: newId(), name: name.trim(), email: clean, phone: phone.trim(), address: address.trim(), role: 0, passwordHash: await sha256(password), wishlist: [], tokenVersion: 0, createdAt: new Date(now()).toISOString() };
    c.db.users.push(user);
    return ok({ message: 'Register Successfull', user: publicUser(user) }, 201);
  });
  add('POST', `${V}/auth/login`, async (c) => {
    const { email, password } = c.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) throw bad('Invalid Email or Password');
    const user = c.db.users.find((u) => u.email === email.trim().toLowerCase());
    if (!user) throw bad('Email is not registered', 404);
    if (user.passwordHash !== (await sha256(password))) throw bad('Invalid Password', 401);
    return ok({ message: 'Login Successfull', user: publicUser(user), token: makeToken(user) });
  });
  add('GET', `${V}/auth/me`, (c) => ok({ user: publicUser(ctxUser(c)) }));
  add('POST', `${V}/auth/logout`, (c) => {
    ctxUser(c).tokenVersion += 1;
    return ok({ message: 'Logged out; existing tokens revoked' });
  });
  add('PUT', `${V}/auth/profile`, (c) => {
    const u = ctxUser(c);
    const { name, phone, address } = c.body;
    if (!isStr(name, 1, 100)) throw bad('Name is Required');
    if (!isStr(phone, 1, 30)) throw bad('phone no is Required');
    if (!isStr(address, 1, 300)) throw bad('address is Required');
    Object.assign(u, { name: name.trim(), phone: phone.trim(), address: address.trim() });
    return ok({ message: 'Profile updated', user: publicUser(u) });
  });

  // categories
  add('GET', `${V}/categories`, (c) => ok({ message: 'Categories fetched', categories: [...c.db.categories].sort((a, b) => a.name.localeCompare(b.name)) }));
  const catName = (c, excludeId) => {
    if (!isStr(c.body.name, 1, 60)) throw bad('Name is required (max 60 chars)');
    const slug = slugify(c.body.name);
    if (!slug) throw bad('Name must contain letters or digits');
    if (c.db.categories.some((x) => x.slug === slug && x._id !== excludeId)) throw bad('Category already exists', 409);
    return { name: c.body.name.trim(), slug };
  };
  add('POST', `${V}/categories`, (c) => {
    ctxAdmin(c);
    const cat = { _id: newId(), ...catName(c), createdAt: new Date(now()).toISOString() };
    c.db.categories.push(cat);
    return ok({ message: 'Category created', category: cat }, 201);
  });
  add('PUT', `${V}/categories/:id`, (c) => {
    ctxAdmin(c);
    const cat = c.db.categories.find((x) => x._id === c.params.id);
    if (!cat) throw bad('Category not found', 404);
    Object.assign(cat, catName(c, cat._id));
    return ok({ message: 'Category updated', category: cat });
  });
  add('DELETE', `${V}/categories/:id`, (c) => {
    ctxAdmin(c);
    const cat = c.db.categories.find((x) => x._id === c.params.id);
    if (!cat) throw bad('Category not found', 404);
    if (c.db.products.some((p) => p.category === cat._id)) throw bad('Category has products; move or delete them first', 409);
    c.db.categories = c.db.categories.filter((x) => x !== cat);
    return ok({ message: 'Category deleted' });
  });

  // products
  add('GET', `${V}/products`, (c) => listProducts(c.db, c.query) && { status: 200, data: listProducts(c.db, c.query) });
  add('GET', `${V}/products/:slug/related`, (c) => {
    const p = c.db.products.find((x) => x.slug === c.params.slug.toLowerCase());
    if (!p) throw bad('Product not found', 404);
    const products = c.db.products
      .filter((x) => x.category === p.category && x._id !== p._id)
      .sort((a, b) => b.rating - a.rating || b.sold - a.sold)
      .slice(0, 4)
      .map((x) => withCategory(c.db, x));
    return ok({ message: 'Related products fetched', products });
  });
  add('GET', `${V}/products/:slug`, (c) => {
    const p = c.db.products.find((x) => x.slug === c.params.slug.toLowerCase());
    if (!p) throw bad('Product not found', 404);
    return ok({ message: 'Product fetched', product: withCategory(c.db, p) });
  });
  add('POST', `${V}/products`, (c) => {
    ctxAdmin(c);
    const d = parseProduct(c.db, c.body, false);
    const ts = new Date(now()).toISOString();
    const p = { _id: newId(), photo: '', images: [], variants: [], featured: false, rating: 0, numReviews: 0, sold: 0, ...d, slug: uniqueSlug(c.db, d.name), createdAt: ts, updatedAt: ts };
    c.db.products.push(p);
    return ok({ message: 'Product created', product: p }, 201);
  });
  add('PUT', `${V}/products/:id`, (c) => {
    ctxAdmin(c);
    const p = c.db.products.find((x) => x._id === c.params.id);
    if (!p) throw bad('Product not found', 404);
    const d = parseProduct(c.db, c.body, true);
    if (d.name && d.name !== p.name) d.slug = uniqueSlug(c.db, d.name, p._id);
    Object.assign(p, d, { updatedAt: new Date(now()).toISOString() });
    return ok({ message: 'Product updated', product: p });
  });
  add('DELETE', `${V}/products/:id`, (c) => {
    ctxAdmin(c);
    const p = c.db.products.find((x) => x._id === c.params.id);
    if (!p) throw bad('Product not found', 404);
    c.db.products = c.db.products.filter((x) => x !== p);
    c.db.reviews = c.db.reviews.filter((r) => r.product !== p._id);
    c.db.users.forEach((u) => (u.wishlist = u.wishlist.filter((id) => id !== p._id)));
    return ok({ message: 'Product deleted' });
  });

  // reviews
  add('GET', `${V}/reviews`, (c) => {
    if (!c.query.product) throw bad('A valid product id is required');
    const reviews = c.db.reviews.filter((r) => r.product === c.query.product).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return ok({ message: 'Reviews fetched', reviews });
  });
  add('POST', `${V}/reviews`, (c) => {
    const u = ctxUser(c);
    const { product, rating, comment } = c.body;
    const p = c.db.products.find((x) => x._id === product);
    if (typeof product !== 'string' || !product) throw bad('A valid product id is required');
    const r = toNum(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) throw bad('Rating must be a whole number from 1 to 5');
    if (comment !== undefined && (typeof comment !== 'string' || comment.length > 1000)) throw bad('Comment must be at most 1000 characters');
    if (!p) throw bad('Product not found', 404);
    const verified = c.db.orders.some((o) => o.user === u._id && o.status !== 'Cancelled' && o.items.some((i) => i.product === p._id));
    let review = c.db.reviews.find((x) => x.product === p._id && x.user === u._id);
    if (review) Object.assign(review, { rating: r, comment: (comment || '').trim(), userName: u.name, verified });
    else {
      review = { _id: newId(), product: p._id, user: u._id, userName: u.name, rating: r, comment: (comment || '').trim(), verified, createdAt: new Date(now()).toISOString() };
      c.db.reviews.push(review);
    }
    recalcRating(p, c.db.reviews);
    return ok({ message: 'Review saved', review }, 201);
  });
  add('DELETE', `${V}/reviews/:id`, (c) => {
    const u = ctxUser(c);
    const rev = c.db.reviews.find((x) => x._id === c.params.id);
    if (!rev) throw bad('Review not found', 404);
    if (rev.user !== u._id && u.role !== 1) throw bad('Unauthorized Access', 403);
    c.db.reviews = c.db.reviews.filter((x) => x !== rev);
    const p = c.db.products.find((x) => x._id === rev.product);
    if (p) recalcRating(p, c.db.reviews);
    return ok({ message: 'Review deleted' });
  });

  // wishlist
  const wishOut = (c, u, message) => {
    const products = u.wishlist.map((id) => c.db.products.find((p) => p._id === id)).filter(Boolean).map((p) => withCategory(c.db, p));
    return ok({ message, products, ids: products.map((p) => p._id) });
  };
  add('GET', `${V}/wishlist`, (c) => wishOut(c, ctxUser(c), 'Wishlist fetched'));
  add('POST', `${V}/wishlist/:productId`, (c) => {
    const u = ctxUser(c);
    if (!c.db.products.some((p) => p._id === c.params.productId)) throw bad('Product not found', 404);
    if (!u.wishlist.includes(c.params.productId)) u.wishlist.push(c.params.productId);
    return wishOut(c, u, 'Added to wishlist');
  });
  add('DELETE', `${V}/wishlist/:productId`, (c) => {
    const u = ctxUser(c);
    u.wishlist = u.wishlist.filter((id) => id !== c.params.productId);
    return wishOut(c, u, 'Removed from wishlist');
  });

  // coupons
  add('POST', `${V}/coupons/validate`, (c) => {
    const { code, subtotal } = c.body;
    if (!isStr(code, 1, 30)) throw bad('Enter a coupon code');
    const sub = toNum(subtotal);
    if (!Number.isFinite(sub) || sub < 0) throw bad('A valid subtotal is required');
    const coupon = c.db.coupons.find((x) => x.code === code.trim().toUpperCase());
    const r = evalCoupon(coupon, sub, new Date(now()));
    if (!r.ok) throw bad(r.message);
    return ok({ message: r.message, discount: r.discount, coupon: { code: coupon.code, type: coupon.type, value: coupon.value, description: coupon.description } });
  });
  const parseCoupon = (b, partial) => {
    const d = {};
    const has = (k) => b[k] !== undefined;
    if (!partial || has('code')) {
      if (!isStr(b.code, 3, 30) || !/^[A-Za-z0-9_-]+$/.test(b.code.trim())) throw bad('Code must be 3-30 letters, digits, - or _');
      d.code = b.code.trim().toUpperCase();
    }
    if (!partial || has('type')) {
      if (!['percent', 'fixed'].includes(b.type)) throw bad('Type must be percent or fixed');
      d.type = b.type;
    }
    if (!partial || has('value')) {
      const v = toNum(b.value);
      if (!Number.isFinite(v) || v <= 0 || ((d.type || b.type) === 'percent' && v > 100)) throw bad('Value must be > 0 (and at most 100 for percent)');
      d.value = v;
    }
    if (has('minSubtotal')) {
      const m = toNum(b.minSubtotal === '' ? 0 : b.minSubtotal);
      if (!Number.isFinite(m) || m < 0) throw bad('Minimum subtotal must be >= 0');
      d.minSubtotal = m;
    }
    if (has('usageLimit')) {
      const u = toNum(b.usageLimit === '' ? 0 : b.usageLimit);
      if (!Number.isInteger(u) || u < 0) throw bad('Usage limit must be a whole number >= 0');
      d.usageLimit = u;
    }
    if (has('expiresAt')) {
      if (!b.expiresAt) d.expiresAt = null;
      else if (Number.isNaN(Date.parse(b.expiresAt))) throw bad('Invalid expiry date');
      else d.expiresAt = new Date(b.expiresAt).toISOString();
    }
    if (has('description')) {
      if (typeof b.description !== 'string' || b.description.length > 200) throw bad('Description is too long');
      d.description = b.description.trim();
    }
    if (has('active')) d.active = b.active === true || b.active === 'true';
    return d;
  };
  add('GET', `${V}/coupons`, (c) => {
    ctxAdmin(c);
    return ok({ message: 'Coupons fetched', coupons: c.db.coupons });
  });
  add('POST', `${V}/coupons`, (c) => {
    ctxAdmin(c);
    const d = parseCoupon(c.body, false);
    if (c.db.coupons.some((x) => x.code === d.code)) throw bad('A coupon with this code already exists', 409);
    const coupon = { _id: newId(), description: '', minSubtotal: 0, expiresAt: null, usageLimit: 0, used: 0, active: true, ...d };
    c.db.coupons.unshift(coupon);
    return ok({ message: 'Coupon created', coupon }, 201);
  });
  add('PUT', `${V}/coupons/:id`, (c) => {
    ctxAdmin(c);
    const coupon = c.db.coupons.find((x) => x._id === c.params.id);
    if (!coupon) throw bad('Coupon not found', 404);
    const d = parseCoupon(c.body, true);
    if (d.code && c.db.coupons.some((x) => x.code === d.code && x._id !== coupon._id)) throw bad('A coupon with this code already exists', 409);
    Object.assign(coupon, d);
    return ok({ message: 'Coupon updated', coupon });
  });
  add('DELETE', `${V}/coupons/:id`, (c) => {
    ctxAdmin(c);
    const coupon = c.db.coupons.find((x) => x._id === c.params.id);
    if (!coupon) throw bad('Coupon not found', 404);
    c.db.coupons = c.db.coupons.filter((x) => x !== coupon);
    return ok({ message: 'Coupon deleted' });
  });

  // orders + payments (demo payments are always the mock path)
  add('GET', `${V}/payments/config`, () => ok({ mode: 'mock' }));
  const create = (c) => {
    const u = ctxUser(c);
    const order = placeOrder(c.db, u, c.body);
    return ok({ message: 'Order placed (mock payment)', mode: 'mock', order }, 201);
  };
  add('POST', `${V}/payments/checkout`, create);
  add('POST', `${V}/orders`, create);
  add('GET', `${V}/orders/mine`, (c) => {
    const u = ctxUser(c);
    return ok({ message: 'Orders fetched', orders: c.db.orders.filter((o) => o.user === u._id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
  });
  add('GET', `${V}/orders`, (c) => {
    ctxAdmin(c);
    const page = Math.max(1, Number.parseInt(c.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(c.query.limit) || 20));
    if (c.query.status && !STATUSES.includes(c.query.status)) throw bad('Invalid status filter');
    let list = [...c.db.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (c.query.status) list = list.filter((o) => o.status === c.query.status);
    return ok({ message: 'Orders fetched', orders: list.slice((page - 1) * limit, page * limit).map((o) => orderOut(c.db, o, true)), page, limit, total: list.length, totalPages: Math.max(1, Math.ceil(list.length / limit)) });
  });
  add('GET', `${V}/orders/:id`, (c) => {
    const u = ctxUser(c);
    const o = c.db.orders.find((x) => x._id === c.params.id);
    if (!o || (o.user !== u._id && u.role !== 1)) throw bad('Order not found', 404);
    return ok({ message: 'Order fetched', order: orderOut(c.db, o, true) });
  });
  add('POST', `${V}/orders/:id/cancel`, (c) => {
    const u = ctxUser(c);
    const o = c.db.orders.find((x) => x._id === c.params.id);
    if (!o || o.user !== u._id) throw bad('Order not found', 404);
    if (!['Not Processed', 'Processing'].includes(o.status)) throw bad('This order can no longer be cancelled', 409);
    restock(c.db, o);
    stamp(o, 'Cancelled', 'Cancelled by customer');
    return ok({ message: 'Order cancelled', order: o });
  });
  add('PUT', `${V}/orders/:id/status`, (c) => {
    ctxAdmin(c);
    const o = c.db.orders.find((x) => x._id === c.params.id);
    const { status, note } = c.body;
    if (!STATUSES.includes(status)) throw bad(`Status must be one of: ${STATUSES.join(', ')}`);
    if (!o) throw bad('Order not found', 404);
    if (o.status === 'Cancelled' && status !== 'Cancelled') throw bad('A cancelled order cannot be reopened', 409);
    if (status === 'Cancelled' && o.status !== 'Cancelled') restock(c.db, o);
    stamp(o, status, typeof note === 'string' ? note : '');
    return ok({ message: 'Order status updated', order: o });
  });

  // admin
  add('GET', `${V}/admin/stats`, (c) => {
    ctxAdmin(c);
    const days = Math.min(90, Math.max(7, Number.parseInt(c.query.days) || 14));
    const since = new Date(now() - (days - 1) * DAY);
    since.setUTCHours(0, 0, 0, 0);
    const live = c.db.orders.filter((o) => o.status !== 'Cancelled');
    const series = [];
    for (let i = 0; i < days; i++) {
      const key = new Date(since.getTime() + i * DAY).toISOString().slice(0, 10);
      const day = live.filter((o) => o.createdAt.slice(0, 10) === key);
      series.push({ date: key, revenue: round2(day.reduce((s, o) => s + o.total, 0)), orders: day.length });
    }
    const ordersByStatus = {};
    c.db.orders.forEach((o) => (ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1));
    return ok({
      message: 'Stats fetched',
      revenue: round2(live.reduce((s, o) => s + o.total, 0)),
      orders: live.length,
      users: c.db.users.length,
      products: c.db.products.length,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      ordersByStatus,
      series,
      lowStock: c.db.products.filter((p) => p.quantity <= LOW_STOCK_THRESHOLD).sort((a, b) => a.quantity - b.quantity).slice(0, 10).map(({ name, slug, quantity, photo, _id }) => ({ _id, name, slug, quantity, photo })),
      topProducts: c.db.products.filter((p) => p.sold > 0).sort((a, b) => b.sold - a.sold).slice(0, 5).map(({ name, slug, sold, price, photo, _id }) => ({ _id, name, slug, sold, price, photo })),
    });
  });
  add('GET', `${V}/admin/users`, (c) => {
    ctxAdmin(c);
    const page = Math.max(1, Number.parseInt(c.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(c.query.limit) || 20));
    let list = [...c.db.users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (c.query.search) {
      const s = String(c.query.search).toLowerCase();
      list = list.filter((u) => u.name.toLowerCase().includes(s) || u.email.includes(s));
    }
    return ok({ message: 'Users fetched', users: list.slice((page - 1) * limit, page * limit).map(adminUser), page, limit, total: list.length, totalPages: Math.max(1, Math.ceil(list.length / limit)) });
  });
  add('PUT', `${V}/admin/users/:id/role`, (c) => {
    const me = ctxAdmin(c);
    const role = Number(c.body.role);
    if (![0, 1].includes(role)) throw bad('Role must be 0 (customer) or 1 (admin)');
    if (me._id === c.params.id) throw bad('You cannot change your own role', 409);
    const u = c.db.users.find((x) => x._id === c.params.id);
    if (!u) throw bad('User not found', 404);
    u.role = role;
    return ok({ message: 'Role updated', user: adminUser(u) });
  });
  add('DELETE', `${V}/admin/users/:id`, (c) => {
    const me = ctxAdmin(c);
    if (me._id === c.params.id) throw bad('You cannot delete your own account', 409);
    const u = c.db.users.find((x) => x._id === c.params.id);
    if (!u) throw bad('User not found', 404);
    c.db.users = c.db.users.filter((x) => x !== u);
    return ok({ message: 'User deleted' });
  });

  // ---------- dispatcher with an axios-like surface ----------
  const sleep = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

  const request = async (method, url, { params, data } = {}) => {
    await sleep(latency[0] + Math.random() * (latency[1] - latency[0]));
    try {
      await ensureSeed();
      const [pathPart, qs] = String(url).split('?');
      const query = { ...Object.fromEntries(new URLSearchParams(qs || '')), ...Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')) };
      const body = await normalizeBody(data);
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = r.re.exec(pathPart);
        if (!m) continue;
        const db = load();
        const ctx = { db, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])), query, body, token: readToken() };
        const out = await r.handler(ctx);
        if (method !== 'GET') save(db);
        return { status: out.status, data: JSON.parse(JSON.stringify(out.data)), headers: {}, config: {} };
      }
      throw bad(`Cannot ${method} ${pathPart}`, 404);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      const message = e instanceof HttpError ? e.message : 'Demo backend error';
      if (!(e instanceof HttpError)) console.error(e);
      const err = new Error(message);
      err.response = { status, data: { success: false, message } };
      throw err;
    }
  };

  return {
    get: (url, config) => request('GET', url, config),
    delete: (url, config) => request('DELETE', url, config),
    post: (url, data, config) => request('POST', url, { ...config, data }),
    put: (url, data, config) => request('PUT', url, { ...config, data }),
    resetDemo,
  };
}
