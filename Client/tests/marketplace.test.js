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
const V = '/api/v1';
const ADDR = { name: 'Demo Customer', phone: '5550101', street: '1 Main St', city: 'Town', zip: '12345' };

test('seller: own products only, stats and orders', async () => {
  const api = mk();
  await login(api, 'seller@example.com');
  const mine = (await api.get(`${V}/seller/products`, { params: { limit: 100 } })).data;
  assert.ok(mine.total > 5);
  const other = (await api.get(`${V}/products`, { params: { limit: 60 } })).data.products.find((p) => p.seller?._id && p.seller.storeName !== 'Northwind Goods');
  await fails(api.put(`${V}/products/${other._id}`, { price: 1 }), 403);
  await fails(api.delete(`${V}/products/${other._id}`), 403);
  const cat = (await api.get(`${V}/categories`)).data.categories[0]._id;
  const created = (await api.post(`${V}/products`, { name: 'Seller Test Item', description: 'd', price: 9, quantity: 3, category: cat })).data.product;
  assert.equal(created.seller.storeName, 'Northwind Goods');
  assert.equal((await api.get(`${V}/seller/products`, { params: { search: 'Seller Test' } })).data.total, 1);
  const st = (await api.get(`${V}/seller/stats`)).data;
  assert.ok(st.gross > 0);
  assert.equal(st.earnings, Math.round(st.gross * 0.9 * 100) / 100);
  const orders = (await api.get(`${V}/seller/orders`, { params: { limit: 100 } })).data.orders;
  assert.ok(orders.length > 0 && orders.every((o) => o.items.every((i) => i.seller === created.seller._id)));
  await fails(api.get(`${V}/admin/reports`), 401);
  await login(api, 'user@example.com');
  await fails(api.get(`${V}/seller/stats`), 403);
  await fails(api.post(`${V}/products`, { name: 'x' }), 401);
});

test('seller applications, approval and notification', async () => {
  const api = mk();
  await login(api, 'user@example.com');
  await fails(api.post(`${V}/auth/seller-request`, { storeName: 'x' }), 400);
  assert.equal((await api.post(`${V}/auth/seller-request`, { storeName: 'Maple Makers' })).data.user.sellerRequest, true);
  await login(api, 'admin@example.com');
  const pending = (await api.get(`${V}/admin/users`, { params: { sellerRequest: 'true' } })).data.users;
  assert.ok(pending.length >= 2);
  const me = pending.find((u) => u.storeName === 'Maple Makers');
  assert.equal((await api.put(`${V}/admin/users/${me._id}/role`, { role: 2 })).data.user.role, 2);
  await fails(api.put(`${V}/admin/users/${me._id}/role`, { role: 5 }), 400);
  await login(api, 'user@example.com');
  assert.ok((await api.get(`${V}/notifications`)).data.notifications.some((n) => /seller/i.test(n.message)));
});

test('address book keeps exactly one default', async () => {
  const api = mk();
  await login(api, 'user@example.com');
  assert.equal((await api.get(`${V}/auth/addresses`)).data.addresses.length, 2);
  await fails(api.post(`${V}/auth/addresses`, { ...ADDR, zip: '1' }), 400);
  const r = await api.post(`${V}/auth/addresses`, { ...ADDR, label: 'Gym', isDefault: true });
  assert.equal(r.data.addresses.filter((a) => a.isDefault).length, 1);
  assert.equal(r.data.addresses.find((a) => a.isDefault).label, 'Gym');
  const gym = r.data.addresses.find((a) => a.label === 'Gym');
  const d = await api.delete(`${V}/auth/addresses/${gym._id}`);
  assert.equal(d.data.addresses.filter((a) => a.isDefault).length, 1);
  await fails(api.delete(`${V}/auth/addresses/nope`), 404);
});

test('returns: request, approve restocks, reject, window and permissions', async () => {
  const api = mk();
  await login(api, 'user@example.com');
  const mineOrders = (await api.get(`${V}/orders/mine`)).data.orders;
  const open = mineOrders.find((o) => o.returnRequest?.status === 'requested');
  assert.ok(open);
  await fails(api.post(`${V}/orders/${open._id}/return`, { reason: 'Second try again' }), 409);
  const delivered = mineOrders.find((o) => o.status === 'Delivered' && !o.returnRequest && Date.now() - new Date(o.updatedAt) < 20 * 86400000);
  assert.ok(delivered);
  await fails(api.post(`${V}/orders/${delivered._id}/return`, { reason: 'no' }), 400);
  assert.equal((await api.post(`${V}/orders/${delivered._id}/return`, { reason: 'Not what I expected' })).status, 201);
  await fails(api.put(`${V}/orders/${delivered._id}/return`, { decision: 'approve' }), 401);
  await login(api, 'admin@example.com');
  const pid = delivered.items[0].product;
  const before = (await api.get(`${V}/products`, { params: { ids: pid } })).data.products[0].quantity;
  const ok = (await api.put(`${V}/orders/${delivered._id}/return`, { decision: 'approve', note: 'ok' })).data.order;
  assert.equal(ok.status, 'Returned');
  assert.equal((await api.get(`${V}/products`, { params: { ids: pid } })).data.products[0].quantity, before + delivered.items[0].quantity);
  await fails(api.put(`${V}/orders/${delivered._id}/return`, { decision: 'approve' }), 409);
  await fails(api.put(`${V}/orders/${delivered._id}/status`, { status: 'Processing' }), 409);
  await fails(api.put(`${V}/orders/${open._id}/status`, { status: 'Returned' }), 400);
  assert.equal((await api.put(`${V}/orders/${open._id}/return`, { decision: 'reject', note: 'Used' })).data.order.returnRequest.status, 'rejected');
});

test('seller fulfilment rules, tracking number, notifications', async () => {
  const api = mk();
  await login(api, 'user@example.com');
  const p = (await api.get(`${V}/products`, { params: { limit: 60, inStock: 'true' } })).data.products.find((x) => x.seller?.storeName === 'Northwind Goods' && !x.variants.length);
  const o = (await api.post(`${V}/orders`, { items: [{ product: p._id, quantity: 1 }], shippingAddress: 'Demo Customer, 1 Main St, Town 12345, Tel 5550101', shippingMethod: 'pickup' })).data.order;
  assert.equal(o.items[0].seller, p.seller._id);
  await login(api, 'seller@example.com');
  assert.ok((await api.get(`${V}/notifications`)).data.notifications.some((n) => n.message.includes('New order')));
  await fails(api.put(`${V}/orders/${o._id}/status`, { status: 'Cancelled' }), 409);
  await fails(api.put(`${V}/orders/${o._id}/status`, { status: 'Shipped', trackingNumber: '!' }), 400);
  const sh = (await api.put(`${V}/orders/${o._id}/status`, { status: 'Shipped', trackingNumber: 'TRK-77' })).data.order;
  assert.equal(sh.status, 'Shipped');
  assert.equal(sh.trackingNumber, 'TRK-77');
  await fails(api.put(`${V}/orders/${o._id}/status`, { status: 'Processing' }), 409);
  await login(api, 'orchard@example.com');
  await fails(api.put(`${V}/orders/${o._id}/status`, { status: 'Delivered' }), 404);
  await login(api, 'user@example.com');
  assert.ok((await api.get(`${V}/notifications`)).data.notifications.some((n) => /shipped/.test(n.message)));
});

test('helpful votes, review sorting, notifications read state, admin report', async () => {
  const api = mk();
  await login(api, 'user@example.com');
  const p = (await api.get(`${V}/products`, { params: { limit: 60 } })).data.products.find((x) => x.numReviews >= 2);
  const revs = (await api.get(`${V}/reviews`, { params: { product: p._id, sort: 'highest' } })).data.reviews;
  assert.ok(revs[0].rating >= revs[revs.length - 1].rating);
  const target = revs.find((r) => r.userName !== 'Demo Customer');
  const v = (await api.post(`${V}/reviews/${target._id}/helpful`)).data.review;
  const again = (await api.post(`${V}/reviews/${target._id}/helpful`)).data.review;
  assert.equal(Math.abs(v.helpful.length - again.helpful.length), 1);
  const n = (await api.get(`${V}/notifications`)).data;
  assert.ok(n.unread > 0);
  await api.post(`${V}/notifications/read-all`);
  assert.equal((await api.get(`${V}/notifications`)).data.unread, 0);
  await login(api, 'admin@example.com');
  const rep = (await api.get(`${V}/admin/reports`, { params: { days: 30 } })).data;
  assert.equal(rep.series.length, 30);
  assert.ok(rep.summary.revenue > 0 && rep.bySeller.length >= 2 && rep.byCategory.length >= 2);
  const stats = (await api.get(`${V}/admin/stats`)).data;
  assert.equal(stats.returnsOpen, 1);
  assert.equal(stats.sellerApplications, 1);
});
