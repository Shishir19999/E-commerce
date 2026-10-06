import express from "express";
import { allOrders, createOrder, myOrders, updateOrderStatus } from "../controllers/orderController.js";
import { isAdmin, requireSignIn } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.post("/", requireSignIn, createOrder);
router.get("/mine", requireSignIn, myOrders);
router.get("/", requireSignIn, isAdmin, allOrders);
router.put("/:id/status", requireSignIn, isAdmin, updateOrderStatus);
export default router;
