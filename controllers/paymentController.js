import orderModel from "../models/orderModel.js";
import { fail, serverError } from "../helpers/validate.js";
import { checkShipping, restock } from "../helpers/orderHelper.js";
import { getStripe } from "../helpers/stripe.js";
import { buildOrder } from "./orderController.js";

const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");

// GET /payments/config: lets the client label the active payment path honestly
export const paymentConfig = (req, res) =>
  res.send({ success: true, mode: getStripe(req.app) ? "stripe" : "mock" });

// POST /payments/checkout  body: { items: [{product, quantity, variant?}], shippingAddress, shippingMethod?, couponCode? }
// Stripe configured -> pending order (stock reserved) + Checkout Session; returns { mode: "stripe", url }.
// Not configured   -> MOCK path: order created as "paid (mock)"; returns { mode: "mock", order }.
export const checkout = async (req, res) => {
  let built;
  try {
    const bad = checkShipping(res, req.body?.shippingAddress);
    if (bad) return bad;
    const stripe = getStripe(req.app);

    built = await buildOrder(req, stripe ? { payment: { method: "stripe", status: "pending (stripe)" } } : {});
    if (built.error) return fail(res, built.error.message, built.error.status);
    const { order, pricing } = built;

    if (!stripe) {
      return res.status(201).send({ success: true, message: "Order placed (mock payment)", mode: "mock", order });
    }

    try {
      const currency = process.env.STRIPE_CURRENCY || "usd";
      const cents = (n) => Math.round(n * 100);
      // with a discount the itemised prices no longer add up, so charge one line for the discounted total
      const line_items =
        pricing.discount > 0
          ? [{ quantity: 1, price_data: { currency, unit_amount: cents(pricing.total), product_data: { name: `Order ${order._id} (discount applied)` } } }]
          : [
              ...order.items.map((l) => ({ quantity: l.quantity, price_data: { currency, unit_amount: cents(l.price), product_data: { name: l.name } } })),
              ...(pricing.shipping > 0 ? [{ quantity: 1, price_data: { currency, unit_amount: cents(pricing.shipping), product_data: { name: "Shipping" } } }] : []),
            ];
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        client_reference_id: String(order._id),
        customer_email: req.user.email,
        metadata: { orderId: String(order._id) },
        expires_at: Math.floor(Date.now() / 1000) + 31 * 60, // minimum Stripe allows is 30 min; unpaid stock is released on expiry
        line_items,
        success_url: `${frontendUrl()}/checkout/success?order=${order._id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl()}/checkout/cancel?order=${order._id}`,
      });
      order.stripeSessionId = session.id;
      await order.save();
      return res.status(201).send({ success: true, mode: "stripe", url: session.url, orderId: order._id });
    } catch (err) {
      await orderModel.deleteOne({ _id: order._id });
      throw err;
    }
  } catch (error) {
    if (built?.priced?.rollback) await built.priced.rollback();
    serverError(res, "Error starting checkout", error);
  }
};

// Mounted in app.js with express.raw() BEFORE express.json(): the Stripe signature needs the raw body.
export const webhook = async (req, res) => {
  const stripe = getStripe(req.app);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return fail(res, "Stripe webhook is not configured", 503);
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], secret);
  } catch {
    return fail(res, "Invalid webhook signature", 400);
  }
  try {
    const session = event.data?.object;
    const orderId = session?.metadata?.orderId || session?.client_reference_id;
    if (orderId && event.type === "checkout.session.completed" && session.payment_status === "paid") {
      await orderModel.updateOne(
        { _id: orderId, "payment.status": { $ne: "paid (stripe)" } },
        { $set: { "payment.status": "paid (stripe)" }, $push: { timeline: { status: "Not Processed", note: "Payment received", at: new Date() } } }
      );
    } else if (orderId && event.type === "checkout.session.expired") {
      // atomically claim the pending order, then restock what it reserved
      const order = await orderModel.findOneAndUpdate(
        { _id: orderId, "payment.status": "pending (stripe)" },
        {
          $set: { "payment.status": "expired (stripe)", status: "Cancelled" },
          $push: { timeline: { status: "Cancelled", note: "Payment session expired", at: new Date() } },
        }
      );
      if (order) await restock(order);
    }
    res.send({ received: true });
  } catch (error) {
    serverError(res, "Webhook handling failed", error);
  }
};
