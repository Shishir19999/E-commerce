import express from "express";
import { createProduct, deleteProduct, getProductBySlug, listProducts, updateProduct } from "../controllers/productController.js";
import { isAdmin, requireSignIn } from "../middlewares/authMiddleware.js";
import { uploadPhoto } from "../middlewares/upload.js";

const router = express.Router();
router.get("/", listProducts);
router.get("/:slug", getProductBySlug);
router.post("/", requireSignIn, isAdmin, uploadPhoto, createProduct);
router.put("/:id", requireSignIn, isAdmin, uploadPhoto, updateProduct);
router.delete("/:id", requireSignIn, isAdmin, deleteProduct);
export default router;
