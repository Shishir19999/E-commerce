import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    price: { type: Number, required: true, min: 0 },
    category: { type: mongoose.ObjectId, ref: "category", required: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    // either an absolute http(s) URL or a path like /uploads/<file> served by this API
    photo: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("product", productSchema);
