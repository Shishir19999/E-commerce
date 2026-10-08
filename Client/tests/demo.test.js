import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoApi, memoryStorage } from '../src/demo/server.js';

const mk = () => {
  const storage = memoryStorage();
  const api = createDemoApi({ storage, latency: [0, 0] });
  api.storage = storage;
  return api;
};
const login = async (api, email) => {
  const r = await api.post('/api/v1/auth/login', { email, password: 'Password123!' });
  api.storage.setItem('auth', JSON.stringify({ token: r.data.token }));
  return r.data;
};
const fails = async (p, status) => {
  await assert.rejects(p, (e) => e.response?.status === status);
};

test('seed: 40+ products, categories, demo logins work', async () => {
  const api = mk();
  const r = await api.get('/api/v1/products', { params: { limit: 60 } });
  assert.ok(r.data.total >= 40);
  assert.ok((await api.get('/api/v1/categories')).data.categories.length >= 6);
  assert.equal((await login(api, 'user@example.com')).user.role, 0);
  assert.equal((await login(api, 'admin@example.com')).user.role, 1);
  assert.equal((await login(api, 'seller@example.com')).user.role, 2);
  await fails(api.post('/api/v1/auth/login', { email: 'user@example.com', password: 'nope' }), 401);
});

test('products: filters, sort and search', async () => {
  const api = mk();
  const all = (await api.get('/api/v1/products', { params: { limit: 60 } })).data;
  const cheap = (await api.get('/api/v1/products', { params: { maxPrice: 30, limit: 60 } })).data;
  assert.ok(cheap.total > 0 && cheap.total < all.total);
  assert.ok(cheap.products.every((p) => p.price <= 30));
  const asc = (await api.get('/api/v1/products', { params: { sort: 'price_asc', limit: 60 } })).data.products.map((p) => p.price);
  assert.deepEqual(asc, [...asc].sort((a, b) => a - b));
  const stocked = (await api.get('/api/v1/products', { params: { inStock: 'true', limit: 60 } })).data.products;
  assert.ok(stocked.every((p) => p.quantity > 0));
  const hit = (await api.get('/api/v1/products', { params: { search: 'headphones' } })).data;
  assert.ok(hit.total >= 1);
});

test('orders: totals, coupon, stock, cancel restock, auth guards', async () => {
  const api = mk();
  await fails(api.get('/api/v1/orders/mine'), 401);
  await login(api, 'user@example.com');
  const p = (await api.get('/api/v1/products', { params: { inStock: 'true', limit: 1, sort: 'price_asc' } })).data.products[0];
  const body = { items: [{ product: p._id, quantity: 2 }], shippingAddress: '24 Maple Avenue, Springfield', shippingMethod: 'express', couponCode: 'welcome10' };
  const r = await api.post('/api/v1/payments/checkout', body);
  const o = r.data.order;
  assert.equal(r.data.mode, 'mock');
  assert.equal(o.subtotal, Math.round(p.price * 2 * 100) / 100);
  assert.ok(o.discount > 0 && o.shipping === 12.99);
  assert.equal(o.tax, Math.round((o.subtotal - o.discount) * 8) / 100);
  assert.equal(o.total, Math.round((o.subtotal - o.discount + o.shipping + o.tax) * 100) / 100);
  const after = (await api.get(`/api/v1/products/${p.slug}`)).data.product;
  assert.equal(after.quantity, p.quantity - 2);
  await fails(api.post('/api/v1/payments/checkout', { ...body, items: [{ product: p._id, quantity: 100000 }] }), 400);
  await api.post(`/api/v1/orders/${o._id}/cancel`);
  assert.equal((await api.get(`/api/v1/products/${p.slug}`)).data.product.quantity, p.quantity);
  await fails(api.post('/api/v1/coupons/validate', { code: 'SUMMER20', subtotal: 100 }), 400);
  await fails(api.get('/api/v1/admin/stats'), 401);
});

test('reviews: one per user, aggregate rating; wishlist toggles; admin CRUD', async () => {
  const api = mk();
  await login(api, 'user@example.com');
  const p = (await api.get('/api/v1/products', { params: { limit: 1 } })).data.products[0];
  await api.post('/api/v1/reviews', { product: p._id, rating: 5, comment: 'Great' });
  await api.post('/api/v1/reviews', { product: p._id, rating: 3, comment: 'Updated' });
  const revs = (await api.get('/api/v1/reviews', { params: { product: p._id } })).data.reviews;
  assert.equal(revs.filter((r) => r.comment === 'Updated').length, 1);
  await fails(api.post('/api/v1/reviews', { product: p._id, rating: 9 }), 400);
  assert.deepEqual((await api.post(`/api/v1/wishlist/${p._id}`)).data.ids, [p._id]);
  assert.deepEqual((await api.delete(`/api/v1/wishlist/${p._id}`)).data.ids, []);
  await fails(api.post('/api/v1/categories', { name: 'X' }), 401);
  await login(api, 'admin@example.com');
  const c = (await api.post('/api/v1/categories', { name: 'Test Cat' })).data.category;
  await fails(api.post('/api/v1/categories', { name: 'test cat' }), 409);
  await api.delete(`/api/v1/categories/${c._id}`);
  const stats = (await api.get('/api/v1/admin/stats', { params: { days: 7 } })).data;
  assert.equal(stats.series.length, 7);
});

test('resetDemo restores seed data', async () => {
  const api = mk();
  await login(api, 'admin@example.com');
  const c = (await api.post('/api/v1/categories', { name: 'Temp' })).data.category;
  await api.resetDemo();
  assert.ok(!(await api.get('/api/v1/categories')).data.categories.some((x) => x._id === c._id));
});

