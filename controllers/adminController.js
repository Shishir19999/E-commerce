import orderModel from "../models/orderModel.js";
import productModel from "../models/productModel.js";
import userModel from "../models/userModels.js";
import categoryModel from "../models/categoryModel.js";
import { fail, isId, serverError } from "../helpers/validate.js";
import { LOW_STOCK } from "../helpers/rules.js";
import { buildReport } from "../helpers/reports.js";
import { notify } from "../helpers/notify.js";

export { LOW_STOCK };
const DAY = 86400000;
const dayKey = (d) => d.toISOString().slice(0, 10);

// GET /admin/stats?days=14
export const stats = async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, Number.parseInt(req.query.days) || 14));
    const since = new Date(Date.now() - (days - 1) * DAY);
    since.setUTCHours(0, 0, 0, 0);
    const live = { status: { $nin: ["Cancelled", "Returned"] } };
    const [totals, byStatus, daily, lowStock, topProducts, users, products] = await Promise.all([
      orderModel.aggregate([{ $match: live }, { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }]),
      orderModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      orderModel.aggregate([
        { $match: { ...live, createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
      ]),
      productModel.find({ quantity: { $lte: LOW_STOCK } }).sort({ quantity: 1 }).limit(10).select("name slug quantity photo"),
      productModel.find({ sold: { $gt: 0 } }).sort({ sold: -1 }).limit(5).select("name slug sold price photo"),
      userModel.countDocuments({ role: { $ne: 1 } }),
      productModel.countDocuments(),
    ]);
    const returnsOpen = await orderModel.countDocuments({ "returnRequest.status": "requested" });
    const sellerApplications = await userModel.countDocuments({ sellerRequest: true });
    const map = new Map(daily.map((d) => [d._id, d]));
    const series = [];
    for (let i = 0; i < days; i++) {
      const key = dayKey(new Date(since.getTime() + i * DAY));
      const d = map.get(key);
      series.push({ date: key, revenue: d ? Math.round(d.revenue * 100) / 100 : 0, orders: d ? d.orders : 0 });
    }
    res.send({
      success: true,
      message: "Stats fetched",
      revenue: Math.round((totals[0]?.revenue || 0) * 100) / 100,
      orders: totals[0]?.orders || 0,
      users,
      products,
      lowStockThreshold: LOW_STOCK,
      returnsOpen,
      sellerApplications,
      ordersByStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
      series,
      lowStock,
      topProducts,
    });
  } catch (error) {
    serverError(res, "Error fetching stats", error);
  }
};

// GET /admin/users?page=&limit=&search=
export const listUsers = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit) || 20));
    const filter = {};
    if (["0", "1", "2"].includes(String(req.query.role))) filter.role = Number(req.query.role);
    if (req.query.sellerRequest === "true") filter.sellerRequest = true;
    if (req.query.search) {
      const s = String(req.query.search).slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ name: { $regex: s, $options: "i" } }, { email: { $regex: s, $options: "i" } }];
    }
    const [total, users] = await Promise.all([
      userModel.countDocuments(filter),
      userModel.find(filter).select("-password -tokenVersion -wishlist -addresses").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    ]);
    res.send({ success: true, message: "Users fetched", users, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    serverError(res, "Error fetching users", error);
  }
};

// PUT /admin/users/:id/role { role: 0|1|2 }  (2 = seller; approving an application clears the request flag)
export const setUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = Number(req.body?.role);
    if (!isId(id)) return fail(res, "Invalid user id");
    if (![0, 1, 2].includes(role)) return fail(res, "Role must be 0 (customer), 1 (admin) or 2 (seller)");
    if (String(req.user._id) === id) return fail(res, "You cannot change your own role", 409);
    const existing = await userModel.findById(id);
    if (!existing) return fail(res, "User not found", 404);
    const patch = { role, sellerRequest: false };
    if (role === 2 && !existing.storeName) patch.storeName = existing.name;
    const user = await userModel.findByIdAndUpdate(id, patch, { returnDocument: "after" }).select("-password -tokenVersion -wishlist -addresses");
    if (role === 2 && existing.role !== 2) await notify(id, { type: "seller", message: "You are now a seller. Open your seller dashboard to add products.", link: "/seller" });
    if (existing.sellerRequest && role === 0) await notify(id, { type: "seller", message: "Your seller application was not approved.", link: "/profile" });
    res.send({ success: true, message: "Role updated", user });
  } catch (error) {
    serverError(res, "Error updating user", error);
  }
};

// DELETE /admin/users/:id
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return fail(res, "Invalid user id");
    if (String(req.user._id) === id) return fail(res, "You cannot delete your own account", 409);
    const user = await userModel.findByIdAndDelete(id);
    if (!user) return fail(res, "User not found", 404);
    res.send({ success: true, message: "User deleted" });
  } catch (error) {
    serverError(res, "Error deleting user", error);
  }
};

// GET /admin/reports?days=30: sales summary, category / product / seller breakdowns and coupon usage
export const reports = async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, Number.parseInt(req.query.days) || 30));
    const [orders, products, categories, users] = await Promise.all([
      orderModel.find({}).select("items status total tax shipping discount couponCode createdAt returnRequest").limit(20000).lean(),
      productModel.find({}).select("category").lean(),
      categoryModel.find({}).select("name").lean(),
      userModel.find({ role: 2 }).select("name storeName").lean(),
    ]);
    res.send({ success: true, message: "Report built", ...buildReport({ orders, products, categories, users, days }) });
  } catch (error) {
    serverError(res, "Error building report", error);
  }
};
