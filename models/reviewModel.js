import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.ObjectId, ref: "product", required: true, index: true },
    user: { type: mongoose.ObjectId, ref: "users", required: true },
    userName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000, default: "" },
    // true when the author has a non-cancelled order containing the product
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

export default mongoose.model("review", reviewSchema);
