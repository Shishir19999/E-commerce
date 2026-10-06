import express from "express";
import { checkout, paymentConfig } from "../controllers/paymentController.js";
import { requireSignIn } from "../middlewares/authMiddleware.js";

// The webhook route is mounted separately in app.js (needs the raw body).
const router = express.Router();
router.get("/config", paymentConfig);
router.post("/checkout", requireSignIn, checkout);
export default router;
