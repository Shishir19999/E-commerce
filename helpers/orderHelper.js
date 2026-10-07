import productModel from "../models/productModel.js";
import couponModel from "../models/couponModel.js";
import { fail, isId, isStr } from "./validate.js";
import { SHIPPING_METHODS, evalCoupon, orderTotal, shippingCost } from "./pricing.js";

// Validates items, prices them from the DB and atomically reserves stock per item.
// Returns { lines, total, rollback } or { error: {message, status} }. Prices never come from the client.
export const reserveItems = async (items) => {
  const reserved = []; // for manual rollback (no transactions on a standalone Mongo)
  const rollback = () =>
    Promise.all(reserved.map(([id, q]) => productModel.updateOne({ _id: id }, { $inc: { quantity: q, sold: -q } })));
  try {
    if (!Array.isArray(items) || items.length === 0 || items.length > 50)
      return { error: { message: "Cart must contain 1-50 items", status: 400 } };
    const merged = new Map();
    for (const it of items) {
      if (!it || !isId(it.product)) return { error: { message: "Each item needs a valid product id", status: 400 } };
      const q = Number(it.quantity);
      if (!Number.isInteger(q) || q < 1 || q > 100)
        return { error: { message: "Item quantity must be an integer between 1 and 100", status: 400 } };
      if (it.variant !== undefined && it.variant !== "" && !isStr(it.variant, 1, 80))
        return { error: { message: "Invalid variant selection", status: 400 } };
      // same product with different variants stays on separate lines
      const key = `${it.product}|${it.variant || ""}`;
      const prev = merged.get(key);
      merged.set(key, { product: it.product, variant: it.variant || "", qty: (prev?.qty || 0) + q });
    }
    const lines = [];
    let total = 0;
    for (const { product: productId, variant, qty } of merged.values()) {
      const product = await productModel.findOneAndUpdate(
        { _id: productId, quantity: { $gte: qty } },
        { $inc: { quantity: -qty, sold: qty } },
        { returnDocument: 'after' }
      );
      if (!product) {
        const exists = await productModel.findById(productId);
        await rollback();
        return {
          error: {
            message: exists ? `Not enough stock for "${exists.name}"` : "A product in your cart no longer exists",
            status: 409,
          },
        };
      }
      reserved.push([productId, qty]);
      lines.push({ product: product._id, name: product.name, price: product.price, quantity: qty, variant, photo: product.photo || "" });
      total += product.price * qty;
    }
    return { lines, total: Math.round(total * 100) / 100, rollback };
  } catch (e) {
    await rollback();
    throw e;
  }
};

// Puts stock (and the sold counter) of a cancelled / expired order back
export const restock = (order) =>
  Promise.all(order.items.map((i) => productModel.updateOne({ _id: i.product }, { $inc: { quantity: i.quantity, sold: -i.quantity } })));

export const checkShipping = (res, shippingAddress) =>
  isStr(shippingAddress, 5, 300) ? null : fail(res, "Shipping address is required (5-300 chars)");

// Applies shipping method + coupon on top of the server-priced subtotal.
// Returns { error } or { subtotal, shipping, discount, total, couponCode, shippingMethod }
export const finalizePricing = async (subtotal, { shippingMethod, couponCode } = {}) => {
  if (shippingMethod !== undefined && shippingMethod !== "" && !SHIPPING_METHODS[shippingMethod])
    return { error: { message: "Unknown shipping method", status: 400 } };
  let discount = 0;
  let code = "";
  if (couponCode !== undefined && couponCode !== null && couponCode !== "") {
    if (typeof couponCode !== "string") return { error: { message: "Invalid coupon code", status: 400 } };
    const coupon = await couponModel.findOne({ code: couponCode.trim().toUpperCase() });
    const r = evalCoupon(coupon, subtotal);
    if (!r.ok) return { error: { message: r.message, status: 400 } };
    discount = r.discount;
    code = coupon.code;
  }
  const shipping = shippingCost(shippingMethod, subtotal - discount);
  return { subtotal, shipping, discount, total: orderTotal(subtotal, discount, shipping), couponCode: code, shippingMethod: shippingMethod || "" };
};

export const redeemCoupon = (code) => code && couponModel.updateOne({ code }, { $inc: { used: 1 } });
