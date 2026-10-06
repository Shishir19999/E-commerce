import productModel from "../models/productModel.js";
import { fail, isId, isStr } from "./validate.js";

// Validates items, prices them from the DB and atomically reserves stock per item.
// Returns { lines, total, rollback } or { error: {message, status} }. Prices never come from the client.
export const reserveItems = async (items) => {
  const reserved = []; // for manual rollback (no transactions on a standalone Mongo)
  const rollback = () =>
    Promise.all(reserved.map(([id, q]) => productModel.updateOne({ _id: id }, { $inc: { quantity: q } })));
  try {
    if (!Array.isArray(items) || items.length === 0 || items.length > 50)
      return { error: { message: "Cart must contain 1-50 items", status: 400 } };
    const merged = new Map();
    for (const it of items) {
      if (!it || !isId(it.product)) return { error: { message: "Each item needs a valid product id", status: 400 } };
      const q = Number(it.quantity);
      if (!Number.isInteger(q) || q < 1 || q > 100)
        return { error: { message: "Item quantity must be an integer between 1 and 100", status: 400 } };
      merged.set(it.product, (merged.get(it.product) || 0) + q);
    }
    const lines = [];
    let total = 0;
    for (const [productId, qty] of merged) {
      const product = await productModel.findOneAndUpdate(
        { _id: productId, quantity: { $gte: qty } },
        { $inc: { quantity: -qty } },
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
      lines.push({ product: product._id, name: product.name, price: product.price, quantity: qty });
      total += product.price * qty;
    }
    return { lines, total: Math.round(total * 100) / 100, rollback };
  } catch (e) {
    await rollback();
    throw e;
  }
};

export const checkShipping = (res, shippingAddress) =>
  isStr(shippingAddress, 5, 300) ? null : fail(res, "Shipping address is required (5-300 chars)");
