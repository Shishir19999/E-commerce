import express from "express";
import { createProduct, deleteProduct, getProductBySlug, listProducts, relatedProducts, updateProduct } from "../controllers/productController.js";
import { isStaff, requireSignIn } from "../middlewares/authMiddleware.js";
import { uploadPhoto } from "../middlewares/upload.js";

const router = express.Router();
router.get("/", listProducts);
router.get("/:slug/related", relatedProducts);
router.get("/:slug", getProductBySlug);
router.post("/", requireSignIn, isStaff, uploadPhoto, createProduct);
router.put("/:id", requireSignIn, isStaff, uploadPhoto, updateProduct);
router.delete("/:id", requireSignIn, isStaff, deleteProduct);
export default router;
