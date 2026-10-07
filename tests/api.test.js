// Run with `npm test`. Uses a throwaway database (ecommerce_test on local MongoDB) that is dropped afterwards.
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const TEST_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/ecom_tmp_apitest";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-not-for-production";
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "ecom-uploads-"));
process.env.FRONTEND_URL = "http://frontend.test";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
delete process.env.STRIPE_SECRET_KEY; // never hit real Stripe; start on the mock path

// import after env is set (upload middleware reads UPLOAD_DIR at import time)
const { default: mongoose } = await import("mongoose");
const { default: request } = await import("supertest");
const { default: Stripe } = await import("stripe");
const { default: app } = await import("../app.js");
const { default: userModel } = await import("../models/userModels.js");
const { default: categoryModel } = await import("../models/categoryModel.js");
const { default: productModel } = await import("../models/productModel.js");
const { default: orderModel } = await import("../models/orderModel.js");
const { hashPassword } = await import("../helpers/authHelper.js");

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const api = () => request(app);
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const V1 = "/api/v1";

let adminToken, userToken, category, product;

const reg = (email, extra = {}) =>
  api().post(`${V1}/auth/register`).send({ name: "Tester", email, password: "secret123", phone: "123", address: "1 Test Street", ...extra });
const login = async (email) => (await api().post(`${V1}/auth/login`).send({ email, password: "secret123" })).body;

test.before(async () => {
  await mongoose.connect(TEST_URI);
  await mongoose.connection.dropDatabase();
  await userModel.create({ name: "Admin", email: "admin@example.com", password: await hashPassword("secret123"), phone: "1", address: "HQ", role: 1 });
  adminToken = (await login("admin@example.com")).token;
  await reg("user@example.com");
  userToken = (await login("user@example.com")).token;
  category = await categoryModel.create({ name: "Gadgets", slug: "gadgets" });
  product = await productModel.create({ name: "Widget", slug: "widget", description: "A widget", price: 10.5, category: category._id, quantity: 10 });
});

test.after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

test("auth: register forces role 0 even if role is sent; validation; duplicates", async () => {
  const res = await reg("eve@example.com", { role: 1 });
  assert.equal(res.status, 201);
  assert.equal((await userModel.findOne({ email: "eve@example.com" })).role, 0);
  assert.equal((await reg("bad-email")).status, 400);
  assert.equal((await reg("user@example.com")).status, 409);
  assert.equal((await api().post(`${V1}/auth/login`).send({ email: "user@example.com", password: "nope" })).status, 401);
  assert.equal((await api().post(`${V1}/auth/login`).send({ email: { $ne: null }, password: "x" })).status, 400);
});

test("auth: /me returns the current user; missing or bad token is 401", async () => {
  const me = await api().get(`${V1}/auth/me`).set(bearer(adminToken));
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, "admin@example.com");
  assert.equal(me.body.user.role, 1);
  assert.equal(me.body.user.password, undefined);
  assert.equal((await api().get(`${V1}/auth/me`)).status, 401);
  assert.equal((await api().get(`${V1}/auth/me`).set(bearer("garbage"))).status, 401);
});

test("auth: token of a deleted user is rejected", async () => {
  await reg("ghost@example.com");
  const { token } = await login("ghost@example.com");
  await userModel.deleteOne({ email: "ghost@example.com" });
  const res = await api().get(`${V1}/auth/me`).set(bearer(token));
  assert.equal(res.status, 401);
  assert.match(res.body.message, /no longer exists/);
});

test("revocation: logout bumps tokenVersion; stale tokens rejected; re-login works", async () => {
  await reg("rev@example.com");
  const { token: old } = await login("rev@example.com");
  assert.equal((await api().get(`${V1}/auth/me`).set(bearer(old))).status, 200);
  assert.equal((await api().post(`${V1}/auth/logout`).set(bearer(old))).status, 200);
  assert.equal((await userModel.findOne({ email: "rev@example.com" })).tokenVersion, 1);
  const after = await api().get(`${V1}/auth/me`).set(bearer(old));
  assert.equal(after.status, 401);
  assert.match(after.body.message, /revoked/);
  assert.equal((await api().post(`${V1}/auth/logout`).set(bearer(old))).status, 401);
  const { token: fresh } = await login("rev@example.com");
  assert.equal((await api().get(`${V1}/auth/me`).set(bearer(fresh))).status, 200);
  assert.equal((await api().post(`${V1}/auth/logout`)).status, 401);
});

test("roles: anonymous 401, user 401/403-equivalent, admin allowed", async () => {
  const body = { name: "New", description: "d", price: 5, quantity: 1, category: String(category._id) };
  assert.equal((await api().post(`${V1}/products`).send(body)).status, 401);
  assert.equal((await api().post(`${V1}/products`).set(bearer(userToken)).send(body)).status, 401);
  assert.equal((await api().post(`${V1}/categories`).set(bearer(userToken)).send({ name: "X" })).status, 401);
  assert.equal((await api().get(`${V1}/orders`).set(bearer(userToken))).status, 401);
  assert.equal((await api().put(`${V1}/orders/${new mongoose.Types.ObjectId()}/status`).set(bearer(userToken)).send({ status: "Shipped" })).status, 401);
  assert.equal((await api().get(`${V1}/orders`).set(bearer(adminToken))).status, 200);
  assert.equal((await api().get(`${V1}/auth/test`).set(bearer(userToken))).status, 401);
  assert.equal((await api().get(`${V1}/auth/test`).set(bearer(adminToken))).status, 200);
});

test("admin: a role change takes effect immediately (role is read from the DB, not the token)", async () => {
  await reg("promo@example.com");
  const { token } = await login("promo@example.com");
  assert.equal((await api().get(`${V1}/orders`).set(bearer(token))).status, 401);
  await userModel.updateOne({ email: "promo@example.com" }, { role: 1 });
  assert.equal((await api().get(`${V1}/orders`).set(bearer(token))).status, 200);
});

test("categories: admin CRUD and public list", async () => {
  const h = bearer(adminToken);
  const c = await api().post(`${V1}/categories`).set(h).send({ name: "Temp Cat" });
  assert.equal(c.status, 201);
  assert.equal((await api().get(`${V1}/categories`)).body.categories.length, 2);
  assert.equal((await api().put(`${V1}/categories/${c.body.category._id}`).set(h).send({ name: "Temp Cat 2" })).status, 200);
  assert.equal((await api().delete(`${V1}/categories/${c.body.category._id}`).set(h)).status, 200);
  assert.equal((await api().post(`${V1}/categories`).set(h).send({ name: "" })).status, 400);
});

test("products: public list/detail; admin create/update/delete with validation", async () => {
  const h = bearer(adminToken);
  const list = await api().get(`${V1}/products?search=widg`);
  assert.equal(list.body.products.length, 1);
  assert.equal((await api().get(`${V1}/products/widget`)).body.product.name, "Widget");
  assert.equal((await api().get(`${V1}/products/nope`)).status, 404);

  const base = { name: "Gizmo", description: "A gizmo", price: 20, quantity: 5, category: String(category._id) };
  assert.equal((await api().post(`${V1}/products`).set(h).send({ ...base, price: -1 })).status, 400);
  assert.equal((await api().post(`${V1}/products`).set(h).send({ ...base, name: "" })).status, 400);
  assert.equal((await api().post(`${V1}/products`).set(h).send({ ...base, category: "bad" })).status, 400);
  assert.equal((await api().post(`${V1}/products`).set(h).send({ ...base, photo: "javascript:alert(1)" })).status, 400);
  const created = await api().post(`${V1}/products`).set(h).send(base);
  assert.equal(created.status, 201);
  const id = created.body.product._id;
  const upd = await api().put(`${V1}/products/${id}`).set(h).send({ price: 25 });
  assert.equal(upd.body.product.price, 25);
  assert.equal((await api().delete(`${V1}/products/${id}`).set(h)).status, 200);
  assert.equal((await api().delete(`${V1}/products/${id}`).set(h)).status, 404);
});

test("products: photo upload validation", async () => {
  const h = bearer(adminToken);
  const f = (r) => r.field("name", "Pic").field("description", "d").field("price", "3").field("quantity", "1").field("category", String(category._id));
  const ok = await f(api().post(`${V1}/products`).set(h)).attach("photo", PNG, { filename: "p.png", contentType: "image/png" });
  assert.equal(ok.status, 201);
  assert.match(ok.body.product.photo, /^\/uploads\/[0-9a-f]{24}\.png$/);
  assert.equal((await api().get(ok.body.product.photo)).status, 200);
  const txt = await f(api().post(`${V1}/products`).set(h)).attach("photo", Buffer.from("hi"), { filename: "x.txt", contentType: "text/plain" });
  assert.equal(txt.status, 400);
  const big = await f(api().post(`${V1}/products`).set(h)).attach("photo", Buffer.alloc(1.5 * 1024 * 1024), { filename: "b.png", contentType: "image/png" });
  assert.equal(big.status, 400);
  assert.equal((await api().delete(`${V1}/products/${ok.body.product._id}`).set(h)).status, 200);
});

test("orders (mock path): server pricing, stock decrement, validation, listing, cancel restocks", async () => {
  const h = bearer(userToken);
  const pid = String(product._id);
  assert.equal((await api().post(`${V1}/orders`).send({})).status, 401);
  assert.equal((await api().post(`${V1}/orders`).set(h).send({ items: [], shippingAddress: "1 Test Street" })).status, 400);
  assert.equal((await api().post(`${V1}/orders`).set(h).send({ items: [{ product: pid, quantity: 1 }] })).status, 400);
  assert.equal((await api().post(`${V1}/orders`).set(h).send({ items: [{ product: pid, quantity: 999 }], shippingAddress: "1 Test Street" })).status, 400);
  assert.equal((await api().post(`${V1}/orders`).set(h).send({ items: [{ product: pid, quantity: 11 }], shippingAddress: "1 Test Street" })).status, 409);
  assert.equal((await productModel.findById(pid)).quantity, 10);

  const res = await api().post(`${V1}/orders`).set(h).send({ items: [{ product: pid, quantity: 2, price: 0.01 }], shippingAddress: "1 Test Street" });
  assert.equal(res.status, 201);
  assert.equal(res.body.order.total, 21);
  assert.equal(res.body.order.payment.status, "paid (mock)");
  assert.equal((await productModel.findById(pid)).quantity, 8);
  assert.equal((await api().get(`${V1}/orders/mine`).set(h)).body.orders.length, 1);

  const id = res.body.order._id;
  const ah = bearer(adminToken);
  assert.equal((await api().put(`${V1}/orders/${id}/status`).set(ah).send({ status: "Bogus" })).status, 400);
  assert.equal((await api().put(`${V1}/orders/${id}/status`).set(ah).send({ status: "Shipped" })).body.order.status, "Shipped");
  assert.equal((await api().get(`${V1}/orders?status=Shipped`).set(ah)).body.total, 1);
  assert.equal((await api().put(`${V1}/orders/${id}/status`).set(ah).send({ status: "Cancelled" })).status, 200);
  assert.equal((await productModel.findById(pid)).quantity, 10);
});

test("payments: mock mode when STRIPE_SECRET_KEY is absent", async () => {
  assert.equal((await api().get(`${V1}/payments/config`)).body.mode, "mock");
  const res = await api().post(`${V1}/payments/checkout`).set(bearer(userToken)).send({ items: [{ product: String(product._id), quantity: 1 }], shippingAddress: "1 Test Street" });
  assert.equal(res.status, 201);
  assert.equal(res.body.mode, "mock");
  assert.equal(res.body.order.payment.status, "paid (mock)");
  assert.equal((await api().post(`${V1}/payments/checkout`).send({})).status, 401);
  assert.equal((await api().post(`${V1}/payments/webhook`).send({})).status, 503);
  await productModel.updateOne({ _id: product._id }, { quantity: 10 });
});

// ---- Stripe path with a MOCKED client (no network, no real Stripe account) ----
test("payments: Stripe checkout built from server-side prices; webhook marks paid; expiry restocks", async () => {
  const real = new Stripe("sk_test_dummy_not_real"); // only used offline for webhook signature helpers
  const calls = [];
  const fake = {
    checkout: {
      sessions: {
        create: async (params) => {
          calls.push(params);
          return { id: "cs_test_123", url: "https://checkout.stripe.test/pay/cs_test_123" };
        },
      },
    },
    webhooks: real.webhooks, // real signature verification
  };
  app.set("stripe", fake);
  const h = bearer(userToken);
  const pid = String(product._id);
  const stock = async () => (await productModel.findById(pid)).quantity;
  try {
    await productModel.updateOne({ _id: pid }, { quantity: 10 });
    assert.equal((await api().get(`${V1}/payments/config`)).body.mode, "stripe");
    // mock order path disabled so payment cannot be bypassed
    assert.equal((await api().post(`${V1}/orders`).set(h).send({ items: [{ product: pid, quantity: 1 }], shippingAddress: "1 Test Street" })).status, 403);

    const res = await api().post(`${V1}/payments/checkout`).set(h).send({ items: [{ product: pid, quantity: 3, price: 0.01 }], shippingAddress: "1 Test Street" });
    assert.equal(res.status, 201);
    assert.equal(res.body.mode, "stripe");
    assert.equal(res.body.url, "https://checkout.stripe.test/pay/cs_test_123");
    const p = calls[0];
    assert.equal(p.mode, "payment");
    assert.equal(p.line_items[0].price_data.unit_amount, 1050); // server price 10.5, not client's 0.01
    assert.equal(p.line_items[0].quantity, 3);
    assert.equal(p.metadata.orderId, res.body.orderId);
    assert.ok(p.success_url.startsWith("http://frontend.test/checkout/success"));
    assert.ok(p.success_url.includes("{CHECKOUT_SESSION_ID}"));
    assert.ok(p.cancel_url.startsWith("http://frontend.test/checkout/cancel"));
    let order = await orderModel.findById(res.body.orderId);
    assert.equal(order.payment.status, "pending (stripe)");
    assert.equal(order.payment.method, "stripe");
    assert.equal(order.total, 31.5);
    assert.equal(await stock(), 7);

    const sign = (payload) => real.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_secret" });
    const post = (payload, sig) => {
      const r = api().post(`${V1}/payments/webhook`).set("Content-Type", "application/json");
      return (sig ? r.set("Stripe-Signature", sig) : r).send(payload);
    };
    const completed = JSON.stringify({ id: "evt_1", object: "event", type: "checkout.session.completed", data: { object: { id: "cs_test_123", payment_status: "paid", metadata: { orderId: res.body.orderId } } } });
    assert.equal((await post(completed, "t=1,v1=bad")).status, 400);
    assert.equal((await post(completed)).status, 400);
    assert.equal((await orderModel.findById(res.body.orderId)).payment.status, "pending (stripe)");
    assert.equal((await post(completed, sign(completed))).status, 200);
    assert.equal((await orderModel.findById(res.body.orderId)).payment.status, "paid (stripe)");
    assert.equal((await post(completed, sign(completed))).status, 200); // replay is idempotent

    // expired session cancels a pending order and restocks
    const r2 = await api().post(`${V1}/payments/checkout`).set(h).send({ items: [{ product: pid, quantity: 2 }], shippingAddress: "1 Test Street" });
    assert.equal(await stock(), 5);
    const expired = JSON.stringify({ id: "evt_2", object: "event", type: "checkout.session.expired", data: { object: { id: "cs_x", metadata: { orderId: r2.body.orderId } } } });
    assert.equal((await post(expired, sign(expired))).status, 200);
    assert.equal((await post(expired, sign(expired))).status, 200); // no double restock
    assert.equal((await orderModel.findById(r2.body.orderId)).status, "Cancelled");
    assert.equal(await stock(), 7);

    // Stripe API failure leaves no orphan order and releases stock
    const count = await orderModel.countDocuments();
    fake.checkout.sessions.create = async () => {
      throw new Error("stripe down");
    };
    assert.equal((await api().post(`${V1}/payments/checkout`).set(h).send({ items: [{ product: pid, quantity: 1 }], shippingAddress: "1 Test Street" })).status, 500);
    assert.equal(await orderModel.countDocuments(), count);
    assert.equal(await stock(), 7);
  } finally {
    app.set("stripe", undefined);
  }
});

test("malformed JSON body returns JSON 400", async () => {
  const res = await api().post(`${V1}/auth/login`).set("Content-Type", "application/json").send("{bad");
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});
