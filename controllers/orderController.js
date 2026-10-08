import orderModel from "../models/orderModel.js";
import { fail, isId, isStr, serverError } from "../helpers/validate.js";
import { checkShipping, finalizePricing, redeemCoupon, reserveItems, restock } from "../helpers/orderHelper.js";
import { getStripe } from "../helpers/stripe.js";
import { adminIds, notify } from "../helpers/notify.js";
import { ORDER_STATUSES, SETTABLE_STATUSES, CANCELLABLE, returnEligibility, sellerStatusError } from "../helpers/rules.js";
import { sellerEarnings } from "../helpers/pricing.js";

const shortId = (id) => String(id).slice(-6).toUpperCase();

// Orders are shown to a seller with only their own lines plus what they earn from them.
export const sellerView = (order, sellerId) => {
  const o = order.toObject ? order.toObject() : order;
  const items = o.items.filter((i) => String(i.seller) === String(sellerId));
  const gross = Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;
  return { ...o, items, sellerSubtotal: gross, sellerEarnings: sellerEarnings(gross) };
};

const sellerIdsOf = (order) => [...new Set(order.items.map((i) => i.seller).filter(Boolean).map(String))];
const hasSeller = (order, userId) => order.items.some((i) => i.seller && String(i.seller) === String(userId));
const canManage = (user, order) => user.role === 1 || (user.role === 2 && hasSeller(order, user._id));

// Reserves stock, prices everything server-side and creates the order document.
// Returns { error } or { order, pricing, priced }. Shared by the mock order endpoint and payment checkout.
export const buildOrder = async (req, extra = {}) => {
  const { items, shippingAddress, shippingMethod, couponCode } = req.body || {};
  const priced = await reserveItems(items);
  if (priced.error) return { error: priced.error };
  try {
    const p = await finalizePricing(priced.total, { shippingMethod, couponCode });
    if (p.error) {
      await priced.rollback();
      return { error: p.error };
    }
    const pending = extra.payment?.status?.startsWith("pending");
    const order = await orderModel.create({
      user: req.user._id,
      items: priced.lines,
      subtotal: p.subtotal,
      discount: p.discount,
      shipping: p.shipping,
      tax: p.tax,
      total: p.total,
      couponCode: p.couponCode,
      shippingMethod: p.shippingMethod,
      shippingAddress: shippingAddress.trim(),
      timeline: [{ status: "Not Processed", note: pending ? "Order placed, awaiting payment" : "Order placed" }],
      ...extra,
    });
    await redeemCoupon(p.couponCode);
    await notifyPlaced(order, priced.lowStock);
    return { order, pricing: p, priced };
  } catch (e) {
    await priced.rollback();
    throw e;
  }
};

const notifyPlaced = async (order, lowStock = []) => {
  const link = `/orders/${order._id}`;
  await notify(order.user, { type: "order", message: `Order #${shortId(order._id)} placed. We will keep you posted.`, link });
  for (const sid of sellerIdsOf(order)) {
    const n = order.items.filter((i) => String(i.seller) === sid).reduce((s, i) => s + i.quantity, 0);
    await notify(sid, { type: "order", message: `New order #${shortId(order._id)}: ${n} item${n === 1 ? "" : "s"} to ship`, link: "/seller/orders" });
  }
  const admins = await adminIds();
  for (const p of lowStock) {
    const to = p.seller ? [p.seller, ...admins] : admins;
    await notify(to, { type: "stock", message: `Low stock: ${p.name} has ${p.quantity} left`, link: p.seller ? "/seller/products" : "/admin/products" });
  }
};

// POST /orders  body: { items: [{product, quantity, variant?}], shippingAddress, shippingMethod?, couponCode? }  -- MOCK payment.
// Disabled when Stripe is configured so payment cannot be bypassed (use POST /payments/checkout).
export const createOrder = async (req, res) => {
  try {
    if (getStripe(req.app)) return fail(res, "Mock orders are disabled; use /api/v1/payments/checkout", 403);
    const bad = checkShipping(res, req.body?.shippingAddress);
    if (bad) return bad;
    const r = await buildOrder(req);
    if (r.error) return fail(res, r.error.message, r.error.status);
    res.status(201).send({ success: true, message: "Order placed (mock payment)", order: r.order });
  } catch (error) {
    serverError(res, "Error creating order", error);
  }
};

export const myOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.send({ success: true, message: "Orders fetched", orders });
  } catch (error) {
    serverError(res, "Error fetching orders", error);
  }
};

// GET /orders/:id (owner, admin, or a seller whose products are in the order)
export const getOrder = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, "Invalid order id");
    const order = await orderModel.findById(req.params.id).populate("user", "name email");
    if (!order) return fail(res, "Order not found", 404);
    const ownerId = String(order.user?._id || order.user);
    if (ownerId === String(req.user._id) || req.user.role === 1) return res.send({ success: true, message: "Order fetched", order });
    if (req.user.role === 2 && hasSeller(order, req.user._id)) return res.send({ success: true, message: "Order fetched", order: sellerView(order, req.user._id) });
    return fail(res, "Order not found", 404);
  } catch (error) {
    serverError(res, "Error fetching order", error);
  }
};

const listFilter = (query) => {
  const filter = {};
  if (query.status) {
    if (!ORDER_STATUSES.includes(query.status)) return { error: "Invalid status filter" };
    filter.status = query.status;
  }
  if (query.returns === "requested") filter["returnRequest.status"] = "requested";
  return { filter };
};

const paged = async (query, base, view) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const [total, orders] = await Promise.all([
    orderModel.countDocuments(base),
    orderModel.find(base).populate("user", "name email").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
  ]);
  return { orders: view ? orders.map(view) : orders, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
};

export const allOrders = async (req, res) => {
  try {
    const { filter, error } = listFilter(req.query);
    if (error) return fail(res, error);
    res.send({ success: true, message: "Orders fetched", ...(await paged(req.query, filter)) });
  } catch (error) {
    serverError(res, "Error fetching orders", error);
  }
};

// GET /seller/orders: orders that contain the signed-in seller's products
export const sellerOrders = async (req, res) => {
  try {
    const { filter, error } = listFilter(req.query);
    if (error) return fail(res, error);
    const data = await paged(req.query, { ...filter, "items.seller": req.user._id }, (o) => sellerView(o, req.user._id));
    res.send({ success: true, message: "Orders fetched", ...data });
  } catch (error) {
    serverError(res, "Error fetching orders", error);
  }
};

const applyStatus = async (order, status, note = "", tracking = "") => {
  if (status === "Cancelled" && order.status !== "Cancelled") await restock(order);
  order.status = status;
  if (tracking) order.trackingNumber = tracking;
  order.timeline.push({ status, note: String(note).slice(0, 200), at: new Date() });
  await order.save();
  await notify(order.user, { type: "order", message: `Order #${shortId(order._id)} is now ${status === "Not Processed" ? "placed" : status.toLowerCase()}`, link: `/orders/${order._id}` });
  return order;
};

// PUT /orders/:id/status { status, note?, trackingNumber? }: admin (any status) or a seller of the order (forward only)
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note, trackingNumber } = req.body || {};
    if (!isId(id)) return fail(res, "Invalid order id");
    if (!SETTABLE_STATUSES.includes(status)) return fail(res, `Status must be one of: ${SETTABLE_STATUSES.join(", ")}`);
    if (trackingNumber !== undefined && trackingNumber !== "" && !(typeof trackingNumber === "string" && /^[A-Za-z0-9 -]{3,40}$/.test(trackingNumber.trim())))
      return fail(res, "Tracking number must be 3-40 letters, digits, spaces or dashes");
    const order = await orderModel.findById(id);
    if (!order) return fail(res, "Order not found", 404);
    if (!canManage(req.user, order)) return fail(res, "Order not found", 404);
    if (req.user.role === 2) {
      const msg = sellerStatusError(order.status, status);
      if (msg) return fail(res, msg, 409);
    } else if (["Cancelled", "Returned"].includes(order.status) && status !== order.status) {
      return fail(res, `A ${order.status.toLowerCase()} order cannot be reopened`, 409);
    }
    await applyStatus(order, status, typeof note === "string" ? note : "", typeof trackingNumber === "string" ? trackingNumber.trim() : "");
    res.send({ success: true, message: "Order status updated", order: req.user.role === 2 ? sellerView(order, req.user._id) : order });
  } catch (error) {
    serverError(res, "Error updating order", error);
  }
};

// POST /orders/:id/cancel: the owner may cancel until the order ships
export const cancelOrder = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, "Invalid order id");
    const order = await orderModel.findById(req.params.id);
    if (!order || String(order.user) !== String(req.user._id)) return fail(res, "Order not found", 404);
    if (!CANCELLABLE.includes(order.status)) return fail(res, "This order can no longer be cancelled", 409);
    await applyStatus(order, "Cancelled", "Cancelled by customer");
    const to = [...sellerIdsOf(order), ...(await adminIds())];
    await notify(to, { type: "order", message: `Order #${shortId(order._id)} was cancelled by the customer`, link: "/orders" });
    res.send({ success: true, message: "Order cancelled", order });
  } catch (error) {
    serverError(res, "Error cancelling order", error);
  }
};

// POST /orders/:id/return { reason }: owner, delivered orders inside the return window
export const requestReturn = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, "Invalid order id");
    const reason = req.body?.reason;
    if (!isStr(reason, 5, 300)) return fail(res, "Tell us why you are returning it (5-300 characters)");
    const order = await orderModel.findById(req.params.id);
    if (!order || String(order.user) !== String(req.user._id)) return fail(res, "Order not found", 404);
    const el = returnEligibility(order.toObject());
    if (!el.ok) return fail(res, el.reason, 409);
    order.returnRequest = { status: "requested", reason: reason.trim(), requestedAt: new Date() };
    order.timeline.push({ status: "Return requested", note: reason.trim().slice(0, 200), at: new Date() });
    await order.save();
    const to = [...sellerIdsOf(order), ...(await adminIds())];
    await notify(to, { type: "return", message: `Return requested for order #${shortId(order._id)}`, link: "/admin/orders" });
    res.status(201).send({ success: true, message: "Return requested", order });
  } catch (error) {
    serverError(res, "Error requesting return", error);
  }
};

// PUT /orders/:id/return { decision: "approve" | "reject", note? }: admin or a seller of the order
export const resolveReturn = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, "Invalid order id");
    const { decision, note } = req.body || {};
    if (!["approve", "reject"].includes(decision)) return fail(res, "Decision must be approve or reject");
    const order = await orderModel.findById(req.params.id);
    if (!order || !canManage(req.user, order)) return fail(res, "Order not found", 404);
    if (order.returnRequest?.status !== "requested") return fail(res, "There is no open return request", 409);
    const text = typeof note === "string" ? note.trim().slice(0, 200) : "";
    order.returnRequest.resolvedAt = new Date();
    order.returnRequest.note = text;
    if (decision === "approve") {
      await restock(order);
      order.returnRequest.status = "approved";
      order.status = "Returned";
      order.payment.status = order.payment.method === "stripe" ? "refund due (stripe)" : "refunded (mock)";
      order.timeline.push({ status: "Returned", note: text || "Return approved, refund issued", at: new Date() });
    } else {
      order.returnRequest.status = "rejected";
      order.timeline.push({ status: "Return rejected", note: text, at: new Date() });
    }
    await order.save();
    await notify(order.user, { type: "return", message: `Your return for order #${shortId(order._id)} was ${decision === "approve" ? "approved" : "declined"}`, link: `/orders/${order._id}` });
    res.send({ success: true, message: decision === "approve" ? "Return approved" : "Return declined", order: req.user.role === 2 ? sellerView(order, req.user._id) : order });
  } catch (error) {
    serverError(res, "Error resolving return", error);
  }
};
