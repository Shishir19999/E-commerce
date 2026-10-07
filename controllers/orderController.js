import orderModel, { ORDER_STATUSES } from "../models/orderModel.js";
import { fail, isId, serverError } from "../helpers/validate.js";
import { checkShipping, finalizePricing, redeemCoupon, reserveItems, restock } from "../helpers/orderHelper.js";
import { getStripe } from "../helpers/stripe.js";

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
      total: p.total,
      couponCode: p.couponCode,
      shippingMethod: p.shippingMethod,
      shippingAddress: shippingAddress.trim(),
      timeline: [{ status: "Not Processed", note: pending ? "Order placed, awaiting payment" : "Order placed" }],
      ...extra,
    });
    await redeemCoupon(p.couponCode);
    return { order, pricing: p, priced };
  } catch (e) {
    await priced.rollback();
    throw e;
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

// GET /orders/:id (owner or admin)
export const getOrder = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, "Invalid order id");
    const order = await orderModel.findById(req.params.id).populate("user", "name email");
    if (!order) return fail(res, "Order not found", 404);
    const ownerId = String(order.user?._id || order.user);
    if (ownerId !== String(req.user._id) && req.user.role !== 1) return fail(res, "Order not found", 404);
    res.send({ success: true, message: "Order fetched", order });
  } catch (error) {
    serverError(res, "Error fetching order", error);
  }
};

export const allOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const filter = {};
    if (req.query.status) {
      if (!ORDER_STATUSES.includes(req.query.status)) return fail(res, "Invalid status filter");
      filter.status = req.query.status;
    }
    const [total, orders] = await Promise.all([
      orderModel.countDocuments(filter),
      orderModel
        .find(filter)
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    res.send({
      success: true,
      message: "Orders fetched",
      orders,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    serverError(res, "Error fetching orders", error);
  }
};

const applyStatus = async (order, status, note = "") => {
  if (status === "Cancelled" && order.status !== "Cancelled") await restock(order);
  order.status = status;
  order.timeline.push({ status, note: String(note).slice(0, 200), at: new Date() });
  await order.save();
  return order;
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body || {};
    if (!isId(id)) return fail(res, "Invalid order id");
    if (!ORDER_STATUSES.includes(status)) return fail(res, `Status must be one of: ${ORDER_STATUSES.join(", ")}`);
    const order = await orderModel.findById(id);
    if (!order) return fail(res, "Order not found", 404);
    if (order.status === "Cancelled" && status !== "Cancelled") return fail(res, "A cancelled order cannot be reopened", 409);
    await applyStatus(order, status, typeof note === "string" ? note : "");
    res.send({ success: true, message: "Order status updated", order });
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
    if (!["Not Processed", "Processing"].includes(order.status)) return fail(res, "This order can no longer be cancelled", 409);
    await applyStatus(order, "Cancelled", "Cancelled by customer");
    res.send({ success: true, message: "Order cancelled", order });
  } catch (error) {
    serverError(res, "Error cancelling order", error);
  }
};
