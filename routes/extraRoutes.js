import express from "express";
import { isAdmin, isSeller, requireSignIn } from "../middlewares/authMiddleware.js";
import { deleteReview, listReviews, saveReview, toggleHelpful } from "../controllers/reviewController.js";
import { createCoupon, deleteCoupon, listCoupons, updateCoupon, validateCoupon } from "../controllers/couponController.js";
import { addToWishlist, getWishlist, removeFromWishlist } from "../controllers/wishlistController.js";
import { deleteUser, listUsers, reports, setUserRole, stats } from "../controllers/adminController.js";
import { sellerProducts, sellerStats } from "../controllers/sellerController.js";
import { sellerOrders } from "../controllers/orderController.js";
import { clearNotifications, listNotifications, markAllRead, markRead } from "../controllers/notificationController.js";

export const reviewRoute = express.Router();
reviewRoute.get("/", listReviews);
reviewRoute.post("/", requireSignIn, saveReview);
reviewRoute.post("/:id/helpful", requireSignIn, toggleHelpful);
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
adminRoute.get("/reports", reports);
adminRoute.get("/users", listUsers);
adminRoute.put("/users/:id/role", setUserRole);
adminRoute.delete("/users/:id", deleteUser);

export const sellerRoute = express.Router();
sellerRoute.use(requireSignIn, isSeller);
sellerRoute.get("/stats", sellerStats);
sellerRoute.get("/products", sellerProducts);
sellerRoute.get("/orders", sellerOrders);

export const notificationRoute = express.Router();
notificationRoute.use(requireSignIn);
notificationRoute.get("/", listNotifications);
notificationRoute.post("/read-all", markAllRead);
notificationRoute.delete("/", clearNotifications);
notificationRoute.post("/:id/read", markRead);
