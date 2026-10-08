// Marketplace features: sellers, tax, address book, returns, notifications, helpful votes, reports.
// Uses a throwaway database that is dropped afterwards.
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const base = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/ecom_tmp_apitest";
const TEST_URI = base.replace(/\/[^/]*$/, "/ecom_tmp_markettest");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-not-for-production";
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "ecom-uploads-"));
delete process.env.STRIPE_SECRET_KEY;

const { default: mongoose } = await import("mongoose");
const { default: request } = await import("supertest");
const { default: app } = await import("../app.js");
const { default: userModel } = await import("../models/userModels.js");
const { default: categoryModel } = await import("../models/categoryModel.js");
const { default: productModel } = await import("../models/productModel.js");
const { default: orderModel } = await import("../models/orderModel.js");
const { hashPassword } = await import("../helpers/authHelper.js");

const api = () => request(app);
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const V1 = "/api/v1";
const ADDR = "1 Test Street, Testville";

let admin, seller, seller2, buyer, other, cat, own, foreign, storeItem;

const login = async (email) => (await api().post(`${V1}/auth/login`).send({ email, password: "secret123" })).body.token;
const mk = async (email, role = 0, extra = {}) =>
  userModel.create({ name: email.split("@")[0], email, password: await hashPassword("secret123"), phone: "1234567", address: "HQ street", role, ...extra });
const order = (token, items, extra = {}) => api().post(`${V1}/orders`).set(bearer(token)).send({ items, shippingAddress: ADDR, ...extra });

test.before(async () => {
  await mongoose.connect(TEST_URI);
  await mongoose.connection.dropDatabase();
  admin = await mk("admin@example.com", 1);
  seller = await mk("seller@example.com", 2, { storeName: "Acme Goods" });
  seller2 = await mk("seller2@example.com", 2);
  buyer = await mk("buyer@example.com");
  other = await mk("other@example.com");
  cat = await categoryModel.create({ name: "Things", slug: "things" });
  own = await productModel.create({ name: "Own Thing", slug: "own-thing", description: "d", price: 20, category: cat._id, quantity: 12, seller: seller._id });
  foreign = await productModel.create({ name: "Other Thing", slug: "other-thing", description: "d", price: 30, category: cat._id, quantity: 5, seller: seller2._id });
  storeItem = await productModel.create({ name: "Store Thing", slug: "store-thing", description: "d", price: 10, category: cat._id, quantity: 50 });
});

test.after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

test("registration cannot create sellers; applying and approval work", async () => {
  const reg = await api().post(`${V1}/auth/register`).send({ name: "Eve", email: "eve@example.com", password: "secret123", phone: "1234567", address: ADDR, role: 2 });
  assert.equal(reg.status, 201);
  const t = await login("eve@example.com");
  const me = (await api().get(`${V1}/auth/me`).set(bearer(t))).body.user;
  assert.equal(me.role, 0);
  assert.equal((await api().post(`${V1}/auth/seller-request`).set(bearer(t)).send({ storeName: "x" })).status, 400);
  const ap = await api().post(`${V1}/auth/seller-request`).set(bearer(t)).send({ storeName: "Eve Crafts" });
  assert.equal(ap.body.user.sellerRequest, true);
  const ah = bearer(await login("admin@example.com"));
  const pending = (await api().get(`${V1}/admin/users?sellerRequest=true`).set(ah)).body;
  assert.equal(pending.total, 1);
  const ok = await api().put(`${V1}/admin/users/${pending.users[0]._id}/role`).set(ah).send({ role: 2 });
  assert.equal(ok.body.user.role, 2);
  assert.equal(ok.body.user.sellerRequest, false);
  assert.equal(ok.body.user.storeName, "Eve Crafts");
  const notes = (await api().get(`${V1}/notifications`).set(bearer(t))).body;
  assert.equal(notes.unread, 1);
  assert.ok(/seller/i.test(notes.notifications[0].message));
});

test("sellers manage only their own products", async () => {
  const sh = bearer(await login("seller@example.com"));
  const body = { name: "New Thing", description: "d", price: 5, quantity: 3, category: String(cat._id) };
  const created = await api().post(`${V1}/products`).set(sh).send(body);
  assert.equal(created.status, 201);
  assert.equal(String(created.body.product.seller), String(seller._id));
  const id = created.body.product._id;
  assert.equal((await api().put(`${V1}/products/${id}`).set(sh).send({ price: 6 })).body.product.price, 6);
  assert.equal((await api().put(`${V1}/products/${foreign._id}`).set(sh).send({ price: 1 })).status, 403);
  assert.equal((await api().delete(`${V1}/products/${foreign._id}`).set(sh)).status, 403);
  assert.equal((await api().put(`${V1}/products/${storeItem._id}`).set(sh).send({ price: 1 })).status, 403);
  assert.equal((await api().post(`${V1}/products`).set(bearer(await login("buyer@example.com"))).send(body)).status, 401);
  const mine = (await api().get(`${V1}/seller/products`).set(sh)).body;
  assert.equal(mine.total, 2);
  assert.ok(mine.products.every((p) => String(p.seller) === String(seller._id)));
  assert.equal((await api().delete(`${V1}/products/${id}`).set(sh)).status, 200);
  // public listing shows the store name and supports a seller filter
  const list = (await api().get(`${V1}/products?seller=${seller._id}`)).body;
  assert.equal(list.total, 1);
  assert.equal(list.products[0].seller.storeName, "Acme Goods");
  assert.equal((await api().get(`${V1}/products?seller=store`)).body.total, 1);
  assert.equal((await api().get(`${V1}/seller/stats`).set(bearer(await login("buyer@example.com")))).status, 403);
});

test("address book: validation, default handling, limits", async () => {
  const h = bearer(await login("buyer@example.com"));
  const a = { label: "Home", name: "Bea Buyer", phone: "555 0100 22", street: "1 Main St", city: "Town", zip: "12345" };
  assert.equal((await api().post(`${V1}/auth/addresses`).set(h).send({ ...a, zip: "1" })).status, 400);
  const first = await api().post(`${V1}/auth/addresses`).set(h).send(a);
  assert.equal(first.status, 201);
  assert.equal(first.body.addresses[0].isDefault, true);
  const second = await api().post(`${V1}/auth/addresses`).set(h).send({ ...a, label: "Work", isDefault: true });
  assert.equal(second.body.addresses.filter((x) => x.isDefault).length, 1);
  assert.equal(second.body.addresses.find((x) => x.isDefault).label, "Work");
  const firstId = first.body.addresses[0]._id;
  const upd = await api().put(`${V1}/auth/addresses/${firstId}`).set(h).send({ ...a, city: "Elsewhere" });
  assert.equal(upd.body.addresses.find((x) => x._id === firstId).city, "Elsewhere");
  const del = await api().delete(`${V1}/auth/addresses/${second.body.addresses.find((x) => x.isDefault)._id}`).set(h);
  assert.equal(del.body.addresses.length, 1);
  assert.equal(del.body.addresses[0].isDefault, true); // a default is always kept
  assert.equal((await api().delete(`${V1}/auth/addresses/${firstId}`).set(bearer(await login("other@example.com")))).status, 404);
});

let ord;
test("orders: tax, seller snapshot, notifications, seller fulfilment rules", async () => {
  const bh = bearer(await login("buyer@example.com"));
  const r = await order(await login("buyer@example.com"), [{ product: String(own._id), quantity: 2 }, { product: String(foreign._id), quantity: 1 }, { product: String(storeItem._id), quantity: 1 }], { shippingMethod: "standard" });
  assert.equal(r.status, 201);
  ord = r.body.order;
  assert.equal(ord.subtotal, 80);
  assert.equal(ord.tax, 6.4);
  assert.equal(ord.shipping, 0);
  assert.equal(ord.total, 86.4);
  assert.equal(String(ord.items.find((i) => i.name === "Own Thing").seller), String(seller._id));
  assert.equal(ord.items.find((i) => i.name === "Store Thing").seller, null);

  const sh = bearer(await login("seller@example.com"));
  const sOrders = (await api().get(`${V1}/seller/orders`).set(sh)).body;
  assert.equal(sOrders.total, 1);
  assert.equal(sOrders.orders[0].items.length, 1); // only their own lines
  assert.equal(sOrders.orders[0].sellerSubtotal, 40);
  assert.equal(sOrders.orders[0].sellerEarnings, 36);
  const detail = (await api().get(`${V1}/orders/${ord._id}`).set(sh)).body.order;
  assert.equal(detail.items.length, 1);
  assert.equal((await api().get(`${V1}/orders/${ord._id}`).set(bearer(await login("other@example.com")))).status, 404);
  const s2 = bearer(await login("seller2@example.com"));
  assert.equal((await api().get(`${V1}/seller/orders`).set(s2)).body.total, 1);

  // seller moves it forward only, cannot cancel; tracking number validated
  assert.equal((await api().put(`${V1}/orders/${ord._id}/status`).set(sh).send({ status: "Cancelled" })).status, 409);
  assert.equal((await api().put(`${V1}/orders/${ord._id}/status`).set(sh).send({ status: "Shipped", trackingNumber: "!" })).status, 400);
  const shipped = await api().put(`${V1}/orders/${ord._id}/status`).set(sh).send({ status: "Shipped", trackingNumber: "TRK-1234" });
  assert.equal(shipped.body.order.status, "Shipped");
  assert.equal((await orderModel.findById(ord._id)).trackingNumber, "TRK-1234");
  assert.equal((await api().put(`${V1}/orders/${ord._id}/status`).set(sh).send({ status: "Processing" })).status, 409);
  assert.equal((await api().put(`${V1}/orders/${ord._id}/status`).set(bearer(await login("other@example.com"))).send({ status: "Shipped" })).status, 401);
  assert.equal((await api().put(`${V1}/orders/${ord._id}/status`).set(bearer(await login("seller2@example.com"))).send({ status: "Delivered" })).status, 200);
  assert.equal((await api().put(`${V1}/orders/${ord._id}/status`).set(bearer(await login("admin@example.com"))).send({ status: "Returned" })).status, 400);

  // customer, seller and admin notifications
  const mine = (await api().get(`${V1}/notifications`).set(bh)).body;
  assert.ok(mine.unread >= 3);
  assert.ok(mine.notifications.some((n) => /placed/.test(n.message)));
  assert.ok((await api().get(`${V1}/notifications`).set(sh)).body.notifications.some((n) => /New order/.test(n.message)));
  const first = mine.notifications[0];
  assert.equal((await api().post(`${V1}/notifications/${first._id}/read`).set(bh)).body.notification.read, true);
  assert.equal((await api().post(`${V1}/notifications/${first._id}/read`).set(sh)).status, 404);
  await api().post(`${V1}/notifications/read-all`).set(bh);
  assert.equal((await api().get(`${V1}/notifications`).set(bh)).body.unread, 0);
  assert.equal((await api().get(`${V1}/notifications`)).status, 401);
});

test("low stock alert fires once when stock crosses the threshold", async () => {
  const t = await login("buyer@example.com");
  const before = (await api().get(`${V1}/notifications`).set(bearer(await login("seller2@example.com")))).body.notifications.filter((n) => n.type === "stock").length;
  assert.equal((await order(t, [{ product: String(foreign._id), quantity: 1 }])).status, 201);
  const after = (await api().get(`${V1}/notifications`).set(bearer(await login("seller2@example.com")))).body.notifications.filter((n) => n.type === "stock").length;
  assert.equal(after, before); // it started below the threshold, so no repeat
  assert.equal((await order(t, [{ product: String(own._id), quantity: 1 }])).status, 201);
  assert.equal((await order(t, [{ product: String(own._id), quantity: 1 }])).status, 201);
  const sn = (await api().get(`${V1}/notifications`).set(bearer(await login("seller@example.com")))).body.notifications.filter((n) => n.type === "stock");
  assert.equal(sn.length, 1);
});

test("returns: eligibility, request, approve restocks and refunds, reject", async () => {
  const bt = await login("buyer@example.com");
  const bh = bearer(bt);
  const ah = bearer(await login("admin@example.com"));
  const o = (await order(bt, [{ product: String(storeItem._id), quantity: 2 }])).body.order;
  assert.equal((await api().post(`${V1}/orders/${o._id}/return`).set(bh).send({ reason: "Does not fit at all" })).status, 409); // not delivered
  await api().put(`${V1}/orders/${o._id}/status`).set(ah).send({ status: "Delivered" });
  assert.equal((await api().post(`${V1}/orders/${o._id}/return`).set(bh).send({ reason: "no" })).status, 400);
  assert.equal((await api().post(`${V1}/orders/${o._id}/return`).set(bearer(await login("other@example.com"))).send({ reason: "Not mine to return" })).status, 404);
  const stockBefore = (await productModel.findById(storeItem._id)).quantity;
  const req = await api().post(`${V1}/orders/${o._id}/return`).set(bh).send({ reason: "Does not fit at all" });
  assert.equal(req.status, 201);
  assert.equal(req.body.order.returnRequest.status, "requested");
  assert.equal((await api().post(`${V1}/orders/${o._id}/return`).set(bh).send({ reason: "Second try again" })).status, 409);
  assert.equal((await api().get(`${V1}/orders?returns=requested`).set(ah)).body.total, 1);
  assert.equal((await api().put(`${V1}/orders/${o._id}/return`).set(bh).send({ decision: "approve" })).status, 401);
  assert.equal((await api().put(`${V1}/orders/${o._id}/return`).set(ah).send({ decision: "maybe" })).status, 400);
  const ok = await api().put(`${V1}/orders/${o._id}/return`).set(ah).send({ decision: "approve", note: "Refunded" });
  assert.equal(ok.body.order.status, "Returned");
  assert.equal(ok.body.order.payment.status, "refunded (mock)");
  assert.equal((await productModel.findById(storeItem._id)).quantity, stockBefore + 2);
  assert.equal((await api().put(`${V1}/orders/${o._id}/return`).set(ah).send({ decision: "approve" })).status, 409);
  assert.equal((await api().put(`${V1}/orders/${o._id}/status`).set(ah).send({ status: "Processing" })).status, 409);
  assert.ok((await api().get(`${V1}/notifications`).set(bh)).body.notifications.some((n) => /return/.test(n.message)));

  // rejected path + the 30-day window
  const o2 = (await order(bt, [{ product: String(storeItem._id), quantity: 1 }])).body.order;
  await api().put(`${V1}/orders/${o2._id}/status`).set(ah).send({ status: "Delivered" });
  await api().post(`${V1}/orders/${o2._id}/return`).set(bh).send({ reason: "Changed my mind" });
  const rej = await api().put(`${V1}/orders/${o2._id}/return`).set(ah).send({ decision: "reject", note: "Used item" });
  assert.equal(rej.body.order.status, "Delivered");
  assert.equal(rej.body.order.returnRequest.status, "rejected");
  const o3 = (await order(bt, [{ product: String(storeItem._id), quantity: 1 }])).body.order;
  await api().put(`${V1}/orders/${o3._id}/status`).set(ah).send({ status: "Delivered" });
  const old = new Date(Date.now() - 40 * 86400000);
  await orderModel.updateOne({ _id: o3._id }, { $set: { "timeline.1.at": old } });
  const late = await api().post(`${V1}/orders/${o3._id}/return`).set(bh).send({ reason: "Way too late now" });
  assert.equal(late.status, 409);
  assert.match(late.body.message, /window/);
});

test("reviews: helpful votes toggle, sorting, seller notified of new reviews", async () => {
  const bt = await login("buyer@example.com");
  const rv = await api().post(`${V1}/reviews`).set(bearer(bt)).send({ product: String(own._id), rating: 5, comment: "Great" });
  assert.equal(rv.status, 201);
  const rev2 = await api().post(`${V1}/reviews`).set(bearer(await login("other@example.com"))).send({ product: String(own._id), rating: 2, comment: "Meh" });
  const id = rv.body.review._id;
  const oh = bearer(await login("other@example.com"));
  assert.equal((await api().post(`${V1}/reviews/${id}/helpful`).set(bearer(bt))).status, 409); // own review
  assert.equal((await api().post(`${V1}/reviews/${id}/helpful`)).status, 401);
  const up = await api().post(`${V1}/reviews/${id}/helpful`).set(oh);
  assert.equal(up.body.review.helpful.length, 1);
  assert.equal((await api().post(`${V1}/reviews/${id}/helpful`).set(oh)).body.review.helpful.length, 0);
  await api().post(`${V1}/reviews/${rev2.body.review._id}/helpful`).set(bearer(bt));
  const byHelpful = (await api().get(`${V1}/reviews?product=${own._id}&sort=helpful`)).body.reviews;
  assert.equal(byHelpful[0].comment, "Meh");
  const lowest = (await api().get(`${V1}/reviews?product=${own._id}&sort=lowest`)).body.reviews;
  assert.equal(lowest[0].rating, 2);
  const sn = (await api().get(`${V1}/notifications`).set(bearer(await login("seller@example.com")))).body.notifications;
  assert.ok(sn.some((n) => /review/.test(n.message)));
});

test("reports and seller stats agree with the orders", async () => {
  const ah = bearer(await login("admin@example.com"));
  const rep = (await api().get(`${V1}/admin/reports?days=30`).set(ah)).body;
  const live = (await orderModel.find({ status: { $nin: ["Cancelled", "Returned"] } })).reduce((s, o) => s + o.total, 0);
  assert.equal(rep.summary.revenue, Math.round(live * 100) / 100);
  assert.equal(rep.series.length, 30);
  assert.equal(rep.series.reduce((s, d) => s + d.revenue, 0).toFixed(2), live.toFixed(2));
  assert.ok(rep.byCategory.length >= 1 && rep.bySeller.length >= 2);
  assert.equal(rep.summary.returned, 1);
  assert.equal((await api().get(`${V1}/admin/reports`).set(bearer(await login("seller@example.com")))).status, 401);

  const st = (await api().get(`${V1}/seller/stats`).set(bearer(await login("seller@example.com")))).body;
  assert.ok(st.gross >= 40);
  assert.equal(st.earnings, Math.round(st.gross * 0.9 * 100) / 100);
  assert.equal(st.series.length, 14);
  assert.ok(st.topProducts[0].name === "Own Thing");
  const stats = (await api().get(`${V1}/admin/stats`).set(ah)).body;
  assert.equal(typeof stats.returnsOpen, "number");
});

test("shared rule files are identical on the server and in the client", () => {
  for (const f of ["pricing.js", "rules.js", "reports.js"]) {
    const a = fs.readFileSync(new URL(`../helpers/${f}`, import.meta.url), "utf8");
    const b = fs.readFileSync(new URL(`../Client/src/lib/${f}`, import.meta.url), "utf8");
    assert.equal(a, b, `${f} must be copied to Client/src/lib`);
  }
});
