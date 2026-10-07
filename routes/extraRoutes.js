import express from "express";
import { isAdmin, requireSignIn } from "../middlewares/authMiddleware.js";
import { deleteReview, listReviews, saveReview } from "../controllers/reviewController.js";
import { createCoupon, deleteCoupon, listCoupons, updateCoupon, validateCoupon } from "../controllers/couponController.js";
import { addToWishlist, getWishlist, removeFromWishlist } from "../controllers/wishlistController.js";
import { deleteUser, listUsers, setUserRole, stats } from "../controllers/adminController.js";

export const reviewRoute = express.Router();
reviewRoute.get("/", listReviews);
reviewRoute.post("/", requireSignIn, saveReview);
reviewRoute.delete("/:id", requireSignIn, deleteReview);

export const couponRoute = express.Router();
couponRoute.post("/validate", validateCoupon);
couponRoute.get("/", requireSignIn, isAdmin, listCoupons);
couponRoute.post("/", requireSignIn, isAdmin, createCoupon);
couponRoute.put("/:id", requireSignIn, isAdmin, updateCoupon);
couponRoute.delete("/:id", requireSignIn, isAdmin, deleteCoupon);

export const wishlistRoute = express.Router();
wishlistRoute.use(requireSignIn);
wishlistRoute.get("/", getWishlist);
wishlistRoute.post("/:productId", addToWishlist);
wishlistRoute.delete("/:productId", removeFromWishlist);

export const adminRoute = express.Router();
adminRoute.use(requireSignIn, isAdmin);
adminRoute.get("/stats", stats);
adminRoute.get("/users", listUsers);
adminRoute.put("/users/:id/role", setUserRole);
adminRoute.delete("/users/:id", deleteUser);
