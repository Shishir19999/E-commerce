import categoryModel from "../models/categoryModel.js";
import productModel from "../models/productModel.js";
import { fail, isId, isStr, serverError, slugify } from "../helpers/validate.js";

export const createCategory = async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!isStr(name, 1, 60)) return fail(res, "Name is required (max 60 chars)");
    const slug = slugify(name);
    if (!slug) return fail(res, "Name must contain letters or digits");
    if (await categoryModel.findOne({ slug })) return fail(res, "Category already exists", 409);
    const category = await categoryModel.create({ name: name.trim(), slug });
    res.status(201).send({ success: true, message: "Category created", category });
  } catch (error) {
    serverError(res, "Error creating category", error);
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body || {};
    if (!isId(id)) return fail(res, "Invalid category id");
    if (!isStr(name, 1, 60)) return fail(res, "Name is required (max 60 chars)");
    const slug = slugify(name);
    if (!slug) return fail(res, "Name must contain letters or digits");
    if (await categoryModel.findOne({ slug, _id: { $ne: id } })) return fail(res, "Category already exists", 409);
    const category = await categoryModel.findByIdAndUpdate(id, { name: name.trim(), slug }, { returnDocument: 'after' });
    if (!category) return fail(res, "Category not found", 404);
    res.send({ success: true, message: "Category updated", category });
  } catch (error) {
    serverError(res, "Error updating category", error);
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return fail(res, "Invalid category id");
    if (await productModel.exists({ category: id }))
      return fail(res, "Category has products; move or delete them first", 409);
    const category = await categoryModel.findByIdAndDelete(id);
    if (!category) return fail(res, "Category not found", 404);
    res.send({ success: true, message: "Category deleted" });
  } catch (error) {
    serverError(res, "Error deleting category", error);
  }
};

export const listCategories = async (req, res) => {
  try {
    const categories = await categoryModel.find().sort({ name: 1 });
    res.send({ success: true, message: "Categories fetched", categories });
  } catch (error) {
    serverError(res, "Error fetching categories", error);
  }
};
