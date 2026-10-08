import mongoose from "mongoose";

import { ORDER_STATUSES } from "../helpers/rules.js";

export { ORDER_STATUSES };

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.ObjectId, ref: "users", required: true },
    items: [
      {
        product: { type: mongoose.ObjectId, ref: "product", required: true },
        name: { type: String, required: true }, // snapshot at purchase time
        price: { type: Number, required: true }, // snapshot, computed server-side
        quantity: { type: Number, required: true, min: 1 },
        variant: { type: String, default: "" },
        photo: { type: String, default: "" },
        seller: { type: mongoose.ObjectId, default: null }, // snapshot of the product owner
      },
    ],
    subtotal: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    shipping: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, default: "" },
    shippingMethod: { type: String, default: "" },
    total: { type: Number, required: true, min: 0 },
    shippingAddress: { type: String, required: true, trim: true },
    status: { type: String, enum: ORDER_STATUSES, default: "Not Processed" },
    // status history shown as the tracking timeline
    timeline: {
      type: [{ _id: false, status: String, note: { type: String, default: "" }, at: { type: Date, default: Date.now } }],
      default: [],
    },
    trackingNumber: { type: String, default: "", maxlength: 40 },
    // customer return request: status requested -> approved (order becomes Returned, stock back) or rejected
    returnRequest: {
      status: { type: String, enum: ["requested", "approved", "rejected"] },
      reason: { type: String, maxlength: 300 },
      requestedAt: Date,
      resolvedAt: Date,
      note: { type: String, maxlength: 200 },
    },
    // method "mock": no real payment processed. method "stripe": pending -> "paid (stripe)" via webhook.
    payment: {
      method: { type: String, default: "mock" },
      status: { type: String, default: "paid (mock)" },
    },
    stripeSessionId: { type: String, index: true, sparse: true },
  },
  { timestamps: true }
);

export default mongoose.model("order", orderSchema);
