import express from "express";
import { allOrders, cancelOrder, createOrder, getOrder, myOrders, updateOrderStatus } from "../controllers/orderController.js";
import { isAdmin, requireSignIn } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.post("/", requireSignIn, createOrder);
router.get("/mine", requireSignIn, myOrders);
router.get("/", requireSignIn, isAdmin, allOrders);
router.get("/:id", requireSignIn, getOrder);
router.post("/:id/cancel", requireSignIn, cancelOrder);
router.put("/:id/status", requireSignIn, isAdmin, updateOrderStatus);
export default router;
