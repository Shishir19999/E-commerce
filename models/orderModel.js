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
      },
    ],
    total: { type: Number, required: true, min: 0 },
    shippingAddress: { type: String, required: true, trim: true },
    status: { type: String, enum: ORDER_STATUSES, default: "Not Processed" },
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
