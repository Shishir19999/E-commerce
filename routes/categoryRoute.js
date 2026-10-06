import express from "express";
import { createCategory, deleteCategory, listCategories, updateCategory } from "../controllers/categoryController.js";
import { isAdmin, requireSignIn } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.get("/", listCategories);
router.post("/", requireSignIn, isAdmin, createCategory);
router.put("/:id", requireSignIn, isAdmin, updateCategory);
router.delete("/:id", requireSignIn, isAdmin, deleteCategory);
export default router;
