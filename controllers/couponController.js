import couponModel from "../models/couponModel.js";
import { fail, isId, isStr, serverError, toNum } from "../helpers/validate.js";
import { evalCoupon } from "../helpers/pricing.js";

// POST /coupons/validate { code, subtotal } -> { discount, coupon } (public: the cart shows the saving before login)
export const validateCoupon = async (req, res) => {
  try {
    const { code, subtotal } = req.body || {};
    if (!isStr(code, 1, 30)) return fail(res, "Enter a coupon code");
    const sub = toNum(subtotal);
    if (!Number.isFinite(sub) || sub < 0) return fail(res, "A valid subtotal is required");
    const coupon = await couponModel.findOne({ code: code.trim().toUpperCase() });
    const r = evalCoupon(coupon, sub);
    if (!r.ok) return fail(res, r.message);
    res.send({
      success: true,
      message: r.message,
      discount: r.discount,
      coupon: { code: coupon.code, type: coupon.type, value: coupon.value, description: coupon.description },
    });
  } catch (error) {
    serverError(res, "Error validating coupon", error);
  }
};

const parse = (body, partial) => {
  const d = {};
  const has = (k) => body[k] !== undefined;
  if (!partial || has("code")) {
    if (!isStr(body.code, 3, 30) || !/^[A-Za-z0-9_-]+$/.test(body.code.trim())) return { error: "Code must be 3-30 letters, digits, - or _" };
    d.code = body.code.trim().toUpperCase();
  }
  if (!partial || has("type")) {
    if (!["percent", "fixed"].includes(body.type)) return { error: "Type must be percent or fixed" };
    d.type = body.type;
  }
  if (!partial || has("value")) {
    const v = toNum(body.value);
    const type = d.type || body.type;
    if (!Number.isFinite(v) || v <= 0 || (type === "percent" && v > 100)) return { error: "Value must be > 0 (and at most 100 for percent)" };
    d.value = v;
  }
  if (has("minSubtotal")) {
    const m = toNum(body.minSubtotal === "" ? 0 : body.minSubtotal);
    if (!Number.isFinite(m) || m < 0) return { error: "Minimum subtotal must be >= 0" };
    d.minSubtotal = m;
  }
  if (has("usageLimit")) {
    const u = toNum(body.usageLimit === "" ? 0 : body.usageLimit);
    if (!Number.isInteger(u) || u < 0) return { error: "Usage limit must be a whole number >= 0" };
    d.usageLimit = u;
  }
  if (has("expiresAt")) {
    if (!body.expiresAt) d.expiresAt = null;
    else if (Number.isNaN(Date.parse(body.expiresAt))) return { error: "Invalid expiry date" };
    else d.expiresAt = new Date(body.expiresAt);
  }
  if (has("description")) {
    if (typeof body.description !== "string" || body.description.length > 200) return { error: "Description is too long" };
    d.description = body.description.trim();
  }
  if (has("active")) d.active = body.active === true || body.active === "true";
  return { data: d };
};

export const listCoupons = async (req, res) => {
  try {
    res.send({ success: true, message: "Coupons fetched", coupons: await couponModel.find().sort({ createdAt: -1 }) });
  } catch (error) {
    serverError(res, "Error fetching coupons", error);
  }
};

export const createCoupon = async (req, res) => {
  try {
    const { error, data } = parse(req.body || {}, false);
    if (error) return fail(res, error);
    if (await couponModel.exists({ code: data.code })) return fail(res, "A coupon with this code already exists", 409);
    res.status(201).send({ success: true, message: "Coupon created", coupon: await couponModel.create(data) });
  } catch (error) {
    serverError(res, "Error creating coupon", error);
  }
};

export const updateCoupon = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, "Invalid coupon id");
    const { error, data } = parse(req.body || {}, true);
    if (error) return fail(res, error);
    if (data.code && (await couponModel.exists({ code: data.code, _id: { $ne: req.params.id } }))) return fail(res, "A coupon with this code already exists", 409);
    const coupon = await couponModel.findByIdAndUpdate(req.params.id, data, { returnDocument: "after" });
    if (!coupon) return fail(res, "Coupon not found", 404);
    res.send({ success: true, message: "Coupon updated", coupon });
  } catch (error) {
    serverError(res, "Error updating coupon", error);
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, "Invalid coupon id");
    const coupon = await couponModel.findByIdAndDelete(req.params.id);
    if (!coupon) return fail(res, "Coupon not found", 404);
    res.send({ success: true, message: "Coupon deleted" });
  } catch (error) {
    serverError(res, "Error deleting coupon", error);
  }
};
