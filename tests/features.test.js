// Run with `npm test`. Uses a throwaway database that is dropped afterwards (override with TEST_MONGO_URI).
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const base = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/ecom_tmp_apitest";
const TEST_URI = base.replace(/\/[^/]*$/, "/ecom_tmp_featuretest");
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
const { default: couponModel } = await import("../models/couponModel.js");
const { hashPassword } = await import("../helpers/authHelper.js");
const { shippingCost, evalCoupon, orderTotal } = await import("../helpers/pricing.js");

const api = () => request(app);
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const V1 = "/api/v1";
const ADDR = "1 Test Street, Testville";

let adminToken, userToken, otherToken, cat, cat2, widget, gizmo, adminId, userId;

const login = async (email) => (await api().post(`${V1}/auth/login`).send({ email, password: "secret123" })).body;
const register = (email) => api().post(`${V1}/auth/register`).send({ name: "Tester", email, password: "secret123", phone: "123", address: ADDR });

test.before(async () => {
  await mongoose.connect(TEST_URI);
  await mongoose.connection.dropDatabase();
  const admin = await userModel.create({ name: "Admin", email: "admin@example.com", password: await hashPassword("secret123"), phone: "1", address: "HQ", role: 1 });
  adminId = String(admin._id);
  adminToken = (await login("admin@example.com")).token;
  await register("user@example.com");
  await register("other@example.com");
  const u = await login("user@example.com");
  userToken = u.token;
  userId = u.user._id;
  otherToken = (await login("other@example.com")).token;
  cat = await categoryModel.create({ name: "Gadgets", slug: "gadgets" });
  cat2 = await categoryModel.create({ name: "Books", slug: "books" });
  widget = await productModel.create({ name: "Widget", slug: "widget", description: "A widget", price: 10, category: cat._id, quantity: 20, rating: 4, numReviews: 2, sold: 5, featured: true });
  gizmo = await productModel.create({ name: "Gizmo", slug: "gizmo", description: "A gizmo", price: 80, category: cat._id, quantity: 0, rating: 2, sold: 50 });
  await productModel.create({ name: "Novel", slug: "novel", description: "A novel", price: 15, category: cat2._id, quantity: 4, rating: 5, numReviews: 1 });
});

test.after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

test("pricing helpers: shipping, coupons and totals", () => {
  assert.equal(shippingCost("standard", 20), 4.99);
  assert.equal(shippingCost("standard", 50), 0);
  assert.equal(shippingCost("express", 500), 12.99);
  assert.equal(shippingCost("pickup", 5), 0);
  assert.equal(shippingCost(undefined, 5), 0);
  const pct = { active: true, type: "percent", value: 10, minSubtotal: 20, used: 0, usageLimit: 0 };
  assert.deepEqual(evalCoupon(pct, 100), { ok: true, discount: 10, message: "Coupon applied" });
  assert.equal(evalCoupon(pct, 10).ok, false);
  assert.equal(evalCoupon({ ...pct, active: false }, 100).ok, false);
  assert.equal(evalCoupon({ ...pct, expiresAt: new Date(Date.now() - 1000) }, 100).ok, false);
  assert.equal(evalCoupon({ ...pct, usageLimit: 3, used: 3 }, 100).ok, false);
  assert.equal(evalCoupon({ ...pct, type: "fixed", value: 500 }, 100).discount, 100); // never more than the subtotal
  assert.equal(orderTotal(100, 10, 4.99), 94.99);
  assert.equal(orderTotal(100, 10, 4.99, 7.2), 102.19);
  assert.equal(orderTotal(10, 50, 0), 0);
});

test("products: filters, sorting, related and extra fields", async () => {
  const get = (q) => api().get(`${V1}/products?${q}`);
  assert.equal((await get("inStock=true")).body.total, 2);
  assert.equal((await get("minPrice=12&maxPrice=100")).body.total, 2);
  assert.equal((await get("minRating=4")).body.total, 2);
  assert.equal((await get("featured=true")).body.products[0].slug, "widget");
  assert.equal((await get("category=books")).body.total, 1);
  assert.equal((await get("sort=price_desc")).body.products[0].slug, "gizmo");
  assert.equal((await get("sort=popular")).body.products[0].slug, "gizmo");
  assert.equal((await get("sort=rating")).body.products[0].slug, "novel");
  const r = await get(`ids=${widget._id},${gizmo._id},nope`);
  assert.equal(r.body.total, 2);
  assert.equal(r.body.maxPrice, 80);
  const rel = await api().get(`${V1}/products/widget/related`);
  assert.deepEqual(rel.body.products.map((p) => p.slug), ["gizmo"]);
  assert.equal((await api().get(`${V1}/products/nope/related`)).status, 404);

  const h = bearer(adminToken);
  const body = { name: "Shirt", description: "d", price: 20, quantity: 3, category: String(cat._id) };
  const ok = await api().post(`${V1}/products`).set(h).send({
    ...body,
    compareAtPrice: 30,
    featured: true,
    images: ["https://img.example.com/a.jpg"],
    variants: [{ name: "Size", options: ["S", "M"] }],
  });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.product.compareAtPrice, 30);
  assert.deepEqual(ok.body.product.variants[0].options, ["S", "M"]);
  assert.equal((await api().post(`${V1}/products`).set(h).send({ ...body, name: "Bad", variants: [{ name: "Size", options: [] }] })).status, 400);
  assert.equal((await api().post(`${V1}/products`).set(h).send({ ...body, name: "Bad2", images: ["javascript:alert(1)"] })).status, 400);
  assert.equal((await api().post(`${V1}/products`).set(h).send({ ...body, name: "Bad3", compareAtPrice: -1 })).status, 400);
  // JSON strings (multipart style) are accepted too
  const str = await api().post(`${V1}/products`).set(h).send({ ...body, name: "Str", variants: JSON.stringify([{ name: "Color", options: ["Red"] }]) });
  assert.equal(str.status, 201);
});

test("reviews: one per user, rating aggregate, verified flag, delete permissions", async () => {
  const pid = String(gizmo._id);
  assert.equal((await api().post(`${V1}/reviews`).send({ product: pid, rating: 5 })).status, 401);
  assert.equal((await api().post(`${V1}/reviews`).set(bearer(userToken)).send({ product: pid, rating: 6 })).status, 400);
  assert.equal((await api().post(`${V1}/reviews`).set(bearer(userToken)).send({ product: "bad", rating: 5 })).status, 400);
  const a = await api().post(`${V1}/reviews`).set(bearer(userToken)).send({ product: pid, rating: 5, comment: "Great" });
  assert.equal(a.status, 201);
  assert.equal(a.body.review.verified, false);
  await api().post(`${V1}/reviews`).set(bearer(otherToken)).send({ product: pid, rating: 2, comment: "Meh" });
  let p = await productModel.findById(pid);
  assert.equal(p.rating, 3.5);
  assert.equal(p.numReviews, 2);
  // re-posting edits instead of duplicating
  await api().post(`${V1}/reviews`).set(bearer(userToken)).send({ product: pid, rating: 4 });
  const list = await api().get(`${V1}/reviews?product=${pid}`);
  assert.equal(list.body.reviews.length, 2);
  assert.equal((await productModel.findById(pid)).rating, 3);
  assert.equal((await api().get(`${V1}/reviews`)).status, 400);
  const mine = list.body.reviews.find((r) => r.userName === "Tester" && r.rating === 4);
  assert.equal((await api().delete(`${V1}/reviews/${mine._id}`).set(bearer(otherToken))).status, 403);
  assert.equal((await api().delete(`${V1}/reviews/${mine._id}`).set(bearer(adminToken))).status, 200);
  assert.equal((await productModel.findById(pid)).numReviews, 1);
});

test("coupons + shipping: admin CRUD, validation, server-side totals, usage limit", async () => {
  const h = bearer(adminToken);
  assert.equal((await api().get(`${V1}/coupons`).set(bearer(userToken))).status, 401);
  assert.equal((await api().post(`${V1}/coupons`).set(h).send({ code: "x", type: "percent", value: 10 })).status, 400);
  assert.equal((await api().post(`${V1}/coupons`).set(h).send({ code: "BIG", type: "percent", value: 150 })).status, 400);
  const c = await api().post(`${V1}/coupons`).set(h).send({ code: "save10", type: "percent", value: 10, minSubtotal: 20, usageLimit: 1 });
  assert.equal(c.status, 201);
  assert.equal(c.body.coupon.code, "SAVE10");
  assert.equal((await api().post(`${V1}/coupons`).set(h).send({ code: "SAVE10", type: "fixed", value: 5 })).status, 409);

  const v = (code, subtotal) => api().post(`${V1}/coupons/validate`).send({ code, subtotal });
  assert.equal((await v("save10", 100)).body.discount, 10);
  assert.equal((await v("save10", 5)).status, 400);
  assert.equal((await v("nope", 100)).status, 400);

  const pid = String(widget._id);
  const order = (extra) => api().post(`${V1}/payments/checkout`).set(bearer(userToken)).send({ items: [{ product: pid, quantity: 3, variant: "Blue" }], shippingAddress: ADDR, ...extra });
  assert.equal((await order({ shippingMethod: "teleport" })).status, 400);
  assert.equal((await order({ couponCode: "NOPE" })).status, 400);
  assert.equal((await productModel.findById(pid)).quantity, 20); // failed attempts released stock
  const ok = await order({ shippingMethod: "standard", couponCode: "save10" });
  assert.equal(ok.status, 201);
  const o = ok.body.order;
  assert.equal(o.subtotal, 30);
  assert.equal(o.discount, 3);
  assert.equal(o.shipping, 4.99); // 27 after discount is below the free-shipping threshold
  assert.equal(o.tax, 2.16);
  assert.equal(o.total, 34.15);
  assert.equal(o.items[0].variant, "Blue");
  assert.equal(o.timeline.length, 1);
  assert.equal((await couponModel.findOne({ code: "SAVE10" })).used, 1);
  assert.equal((await order({ couponCode: "SAVE10" })).status, 400); // usage limit reached
  assert.equal((await productModel.findById(pid)).sold, 5 + 3);
  const upd = await api().put(`${V1}/coupons/${c.body.coupon._id}`).set(h).send({ active: false });
  assert.equal(upd.body.coupon.active, false);
  assert.equal((await api().delete(`${V1}/coupons/${c.body.coupon._id}`).set(h)).status, 200);
});

test("orders: detail access, timeline, owner cancel restocks", async () => {
  const pid = String(widget._id);
  const before = (await productModel.findById(pid)).quantity;
  const res = await api().post(`${V1}/orders`).set(bearer(userToken)).send({ items: [{ product: pid, quantity: 2 }], shippingAddress: ADDR, shippingMethod: "express" });
  assert.equal(res.status, 201);
  assert.equal(res.body.order.total, 34.59);
  const id = res.body.order._id;
  assert.equal((await api().get(`${V1}/orders/${id}`).set(bearer(userToken))).status, 200);
  assert.equal((await api().get(`${V1}/orders/${id}`).set(bearer(adminToken))).body.order.user.email, "user@example.com");
  assert.equal((await api().get(`${V1}/orders/${id}`).set(bearer(otherToken))).status, 404);
  assert.equal((await api().get(`${V1}/orders/${id}`)).status, 401);

  await api().put(`${V1}/orders/${id}/status`).set(bearer(adminToken)).send({ status: "Processing", note: "Packing" });
  const t = (await api().get(`${V1}/orders/${id}`).set(bearer(userToken))).body.order.timeline;
  assert.deepEqual(t.map((x) => x.status), ["Not Processed", "Processing"]);
  assert.equal(t[1].note, "Packing");

  assert.equal((await api().post(`${V1}/orders/${id}/cancel`).set(bearer(otherToken))).status, 404);
  const cancel = await api().post(`${V1}/orders/${id}/cancel`).set(bearer(userToken));
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.order.status, "Cancelled");
  assert.equal((await productModel.findById(pid)).quantity, before);
  assert.equal((await api().post(`${V1}/orders/${id}/cancel`).set(bearer(userToken))).status, 409);

  const shipped = await api().post(`${V1}/orders`).set(bearer(userToken)).send({ items: [{ product: pid, quantity: 1 }], shippingAddress: ADDR });
  await api().put(`${V1}/orders/${shipped.body.order._id}/status`).set(bearer(adminToken)).send({ status: "Shipped" });
  assert.equal((await api().post(`${V1}/orders/${shipped.body.order._id}/cancel`).set(bearer(userToken))).status, 409);
});

test("wishlist: add, list, remove, auth required", async () => {
  const h = bearer(userToken);
  assert.equal((await api().get(`${V1}/wishlist`)).status, 401);
  assert.equal((await api().post(`${V1}/wishlist/bad`).set(h)).status, 400);
  assert.equal((await api().post(`${V1}/wishlist/${new mongoose.Types.ObjectId()}`).set(h)).status, 404);
  await api().post(`${V1}/wishlist/${widget._id}`).set(h);
  const again = await api().post(`${V1}/wishlist/${widget._id}`).set(h);
  assert.deepEqual(again.body.ids, [String(widget._id)]); // no duplicates
  assert.equal(again.body.products[0].category.name, "Gadgets");
  assert.equal((await api().get(`${V1}/wishlist`).set(bearer(otherToken))).body.ids.length, 0);
  assert.equal((await api().delete(`${V1}/wishlist/${widget._id}`).set(h)).body.ids.length, 0);
});

test("admin: stats, user management guards, profile update", async () => {
  const h = bearer(adminToken);
  assert.equal((await api().get(`${V1}/admin/stats`).set(bearer(userToken))).status, 401);
  const s = (await api().get(`${V1}/admin/stats?days=7`).set(h)).body;
  assert.equal(s.series.length, 7);
  assert.ok(s.orders >= 1 && s.revenue > 0);
  assert.ok(s.lowStock.some((p) => p.slug === "gizmo"));
  assert.ok(s.lowStock.every((p) => p.quantity <= s.lowStockThreshold));
  assert.equal(s.topProducts[0].slug, "gizmo");
  assert.equal(s.ordersByStatus.Cancelled, 1);
  assert.equal(s.series.reduce((n, d) => n + d.orders, 0), s.orders);

  const users = (await api().get(`${V1}/admin/users?search=other`).set(h)).body;
  assert.equal(users.total, 1);
  assert.equal(users.users[0].password, undefined);
  const otherId = users.users[0]._id;
  assert.equal((await api().put(`${V1}/admin/users/${adminId}/role`).set(h).send({ role: 0 })).status, 409);
  assert.equal((await api().put(`${V1}/admin/users/${otherId}/role`).set(h).send({ role: 7 })).status, 400);
  assert.equal((await api().put(`${V1}/admin/users/${otherId}/role`).set(h).send({ role: 1 })).body.user.role, 1);
  assert.equal((await api().delete(`${V1}/admin/users/${adminId}`).set(h)).status, 409);
  assert.equal((await api().delete(`${V1}/admin/users/${otherId}`).set(h)).status, 200);
  assert.equal((await api().delete(`${V1}/admin/users/${otherId}`).set(h)).status, 404);

  const p = await api().put(`${V1}/auth/profile`).set(bearer(userToken)).send({ name: "New Name", phone: "999", address: "2 New Road" });
  assert.equal(p.body.user.name, "New Name");
  assert.equal((await userModel.findById(userId)).address, "2 New Road");
  assert.equal((await api().put(`${V1}/auth/profile`).set(bearer(userToken)).send({ name: "", phone: "1", address: "x" })).status, 400);
});
