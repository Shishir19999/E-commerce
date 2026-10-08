import express from "express";
import { allOrders, cancelOrder, createOrder, getOrder, myOrders, requestReturn, resolveReturn, updateOrderStatus } from "../controllers/orderController.js";
import { isAdmin, isStaff, requireSignIn } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.post("/", requireSignIn, createOrder);
router.get("/mine", requireSignIn, myOrders);
router.get("/", requireSignIn, isAdmin, allOrders);
router.get("/:id", requireSignIn, getOrder);
router.post("/:id/cancel", requireSignIn, cancelOrder);
router.post("/:id/return", requireSignIn, requestReturn);
router.put("/:id/return", requireSignIn, isStaff, resolveReturn);
router.put("/:id/status", requireSignIn, isStaff, updateOrderStatus);
export default router;
