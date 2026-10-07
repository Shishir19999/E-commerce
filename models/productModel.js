import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    price: { type: Number, required: true, min: 0 },
    // original price shown struck through when higher than price (0 = none)
    compareAtPrice: { type: Number, min: 0, default: 0 },
    category: { type: mongoose.ObjectId, ref: "category", required: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    // either an absolute http(s) URL or a path like /uploads/<file> served by this API
    photo: { type: String, default: "" },
    // extra gallery images (same rules as photo)
    images: { type: [String], default: [] },
    // selectable options, e.g. [{ name: "Color", options: ["Black", "Silver"] }]
    variants: {
      type: [{ _id: false, name: { type: String, required: true, maxlength: 30 }, options: { type: [String], default: [] } }],
      default: [],
    },
    featured: { type: Boolean, default: false },
    // maintained by the review controller
    rating: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0, min: 0 },
    // units sold in non-cancelled orders (bestseller ranking)
    sold: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("product", productSchema);
