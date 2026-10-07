import userModel from "../models/userModels.js";
import productModel from "../models/productModel.js";
import { fail, isId, serverError } from "../helpers/validate.js";

const send = async (res, userId, message) => {
  const user = await userModel.findById(userId).populate({ path: "wishlist", populate: { path: "category", select: "name slug" } });
  const products = (user?.wishlist || []).filter(Boolean);
  res.send({ success: true, message, products, ids: products.map((p) => String(p._id)) });
};

export const getWishlist = async (req, res) => {
  try {
    await send(res, req.user._id, "Wishlist fetched");
  } catch (error) {
    serverError(res, "Error fetching wishlist", error);
  }
};

export const addToWishlist = async (req, res) => {
  try {
    if (!isId(req.params.productId)) return fail(res, "Invalid product id");
    if (!(await productModel.exists({ _id: req.params.productId }))) return fail(res, "Product not found", 404);
    await userModel.updateOne({ _id: req.user._id }, { $addToSet: { wishlist: req.params.productId } });
    await send(res, req.user._id, "Added to wishlist");
  } catch (error) {
    serverError(res, "Error updating wishlist", error);
  }
};

export const removeFromWishlist = async (req, res) => {
  try {
    if (!isId(req.params.productId)) return fail(res, "Invalid product id");
    await userModel.updateOne({ _id: req.user._id }, { $pull: { wishlist: req.params.productId } });
    await send(res, req.user._id, "Removed from wishlist");
  } catch (error) {
    serverError(res, "Error updating wishlist", error);
  }
};
