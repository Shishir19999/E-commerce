import productModel from "../models/productModel.js";
import orderModel from "../models/orderModel.js";
import { serverError } from "../helpers/validate.js";
import { buildSellerStats } from "../helpers/reports.js";
import { LOW_STOCK } from "../helpers/rules.js";

// GET /seller/stats?days=14
export const sellerStats = async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, Number.parseInt(req.query.days) || 14));
    const [orders, products] = await Promise.all([
      orderModel.find({ "items.seller": req.user._id }).select("items status total createdAt").lean(),
      productModel.find({ seller: req.user._id }).select("name slug quantity photo").lean(),
    ]);
    res.send({ success: true, message: "Stats fetched", ...buildSellerStats({ orders, products, sellerId: req.user._id, days, lowStock: LOW_STOCK }) });
  } catch (error) {
    serverError(res, "Error fetching stats", error);
  }
};

// GET /seller/products?page=&limit=&search=
export const sellerProducts = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit) || 10));
    const filter = { seller: req.user._id };
    if (req.query.search) {
      const s = String(req.query.search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.name = { $regex: s, $options: "i" };
    }
    const [total, products] = await Promise.all([
      productModel.countDocuments(filter),
      productModel.find(filter).populate("category", "name slug").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    ]);
    res.send({ success: true, message: "Products fetched", products, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    serverError(res, "Error fetching products", error);
  }
};
