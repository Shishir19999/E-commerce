import mongoose from "mongoose";

export const ORDER_STATUSES = ["Not Processed", "Processing", "Shipped", "Delivered", "Cancelled"];

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
      },
    ],
    subtotal: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    shipping: { type: Number, default: 0, min: 0 },
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
