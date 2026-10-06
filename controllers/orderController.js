import orderModel, { ORDER_STATUSES } from "../models/orderModel.js";
import productModel from "../models/productModel.js";
import { fail, isId, serverError } from "../helpers/validate.js";
import { checkShipping, reserveItems } from "../helpers/orderHelper.js";
import { getStripe } from "../helpers/stripe.js";

// POST /orders  body: { items: [{product, quantity}], shippingAddress }  -- MOCK payment order creation.
// Disabled when Stripe is configured so payment cannot be bypassed (use POST /payments/checkout).
// Prices come from the DB, never from the client. Stock is decremented atomically per item.
export const createOrder = async (req, res) => {
  let priced;
  try {
    if (getStripe(req.app)) return fail(res, "Mock orders are disabled; use /api/v1/payments/checkout", 403);
    const { items, shippingAddress } = req.body || {};
    const bad = checkShipping(res, shippingAddress);
    if (bad) return bad;
    priced = await reserveItems(items);
    if (priced.error) return fail(res, priced.error.message, priced.error.status);
    const order = await orderModel.create({
      user: req.user._id,
      items: priced.lines,
      total: priced.total,
      shippingAddress: shippingAddress.trim(),
    });
    res.status(201).send({ success: true, message: "Order placed (mock payment)", order });
  } catch (error) {
    if (priced?.rollback) await priced.rollback();
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

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!isId(id)) return fail(res, "Invalid order id");
    if (!ORDER_STATUSES.includes(status)) return fail(res, `Status must be one of: ${ORDER_STATUSES.join(", ")}`);
    const order = await orderModel.findById(id);
    if (!order) return fail(res, "Order not found", 404);
    if (order.status === "Cancelled" && status !== "Cancelled") return fail(res, "A cancelled order cannot be reopened", 409);
    if (status === "Cancelled" && order.status !== "Cancelled") {
      // restock
      await Promise.all(order.items.map((i) => productModel.updateOne({ _id: i.product }, { $inc: { quantity: i.quantity } })));
    }
    order.status = status;
    await order.save();
    res.send({ success: true, message: "Order status updated", order });
  } catch (error) {
    serverError(res, "Error updating order", error);
  }
};
