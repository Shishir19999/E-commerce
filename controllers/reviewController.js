import reviewModel from "../models/reviewModel.js";
import productModel from "../models/productModel.js";
import orderModel from "../models/orderModel.js";
import { fail, isId, serverError, toNum } from "../helpers/validate.js";
import { notify } from "../helpers/notify.js";

const recalc = async (productId) => {
  const [agg] = await reviewModel.aggregate([
    { $match: { product: productId } },
    { $group: { _id: "$product", avg: { $avg: "$rating" }, n: { $sum: 1 } } },
  ]);
  await productModel.updateOne(
    { _id: productId },
    { rating: agg ? Math.round(agg.avg * 10) / 10 : 0, numReviews: agg ? agg.n : 0 }
  );
};

// GET /reviews?product=<id>
export const listReviews = async (req, res) => {
  try {
    if (!isId(String(req.query.product || ""))) return fail(res, "A valid product id is required");
    const reviews = (await reviewModel.find({ product: req.query.product }).sort({ createdAt: -1 }).limit(100)).map((r) => r.toObject());
    const by = {
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      helpful: (a, b) => b.helpful.length - a.helpful.length || new Date(b.createdAt) - new Date(a.createdAt),
      highest: (a, b) => b.rating - a.rating,
      lowest: (a, b) => a.rating - b.rating,
    };
    reviews.sort(by[req.query.sort] || by.newest);
    res.send({ success: true, message: "Reviews fetched", reviews });
  } catch (error) {
    serverError(res, "Error fetching reviews", error);
  }
};

// POST /reviews { product, rating, comment }: one review per user and product (re-posting edits it)
export const saveReview = async (req, res) => {
  try {
    const { product, rating, comment } = req.body || {};
    if (!isId(product)) return fail(res, "A valid product id is required");
    const r = toNum(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) return fail(res, "Rating must be a whole number from 1 to 5");
    if (comment !== undefined && (typeof comment !== "string" || comment.length > 1000)) return fail(res, "Comment must be at most 1000 characters");
    const p = await productModel.findById(product);
    if (!p) return fail(res, "Product not found", 404);
    const verified = !!(await orderModel.exists({ user: req.user._id, status: { $ne: "Cancelled" }, "items.product": p._id }));
    const existed = await reviewModel.exists({ product: p._id, user: req.user._id });
    const review = await reviewModel.findOneAndUpdate(
      { product: p._id, user: req.user._id },
      { $set: { rating: r, comment: (comment || "").trim(), userName: req.user.name, verified } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await recalc(p._id);
    if (!existed && p.seller) await notify(p.seller, { type: "review", message: `New ${r}-star review on ${p.name}`, link: `/product/${p.slug}` });
    res.status(201).send({ success: true, message: "Review saved", review });
  } catch (error) {
    serverError(res, "Error saving review", error);
  }
};

// DELETE /reviews/:id (author or admin)
export const deleteReview = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, "Invalid review id");
    const review = await reviewModel.findById(req.params.id);
    if (!review) return fail(res, "Review not found", 404);
    if (String(review.user) !== String(req.user._id) && req.user.role !== 1) return fail(res, "Unauthorized Access", 403);
    await review.deleteOne();
    await recalc(review.product);
    res.send({ success: true, message: "Review deleted" });
  } catch (error) {
    serverError(res, "Error deleting review", error);
  }
};

// POST /reviews/:id/helpful: toggles the signed-in user's "helpful" vote (not on your own review)
export const toggleHelpful = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, "Invalid review id");
    const review = await reviewModel.findById(req.params.id);
    if (!review) return fail(res, "Review not found", 404);
    if (String(review.user) === String(req.user._id)) return fail(res, "You cannot vote on your own review", 409);
    const voted = review.helpful.some((u) => String(u) === String(req.user._id));
    await reviewModel.updateOne({ _id: review._id }, voted ? { $pull: { helpful: req.user._id } } : { $addToSet: { helpful: req.user._id } });
    const fresh = await reviewModel.findById(review._id);
    res.send({ success: true, message: voted ? "Vote removed" : "Marked as helpful", review: fresh });
  } catch (error) {
    serverError(res, "Error saving vote", error);
  }
};
