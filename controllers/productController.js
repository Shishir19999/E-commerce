import fs from "fs";
import path from "path";
import productModel from "../models/productModel.js";
import categoryModel from "../models/categoryModel.js";
import { UPLOAD_DIR } from "../middlewares/upload.js";
import { fail, isId, isStr, serverError, slugify, toNum } from "../helpers/validate.js";

const removeUpload = (photo) => {
  if (photo && photo.startsWith("/uploads/")) {
    fs.unlink(path.join(UPLOAD_DIR, path.basename(photo)), () => {});
  }
};

const isHttpUrl = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

// Validates body (create: all required; update: only supplied fields). Returns {error} or {data}.
const parseBody = async (body, file, partial) => {
  const data = {};
  const has = (k) => body[k] !== undefined;
  if (!partial || has("name")) {
    if (!isStr(body.name, 1, 120)) return { error: "Name is required (max 120 chars)" };
    data.name = body.name.trim();
  }
  if (!partial || has("description")) {
    if (!isStr(body.description, 1, 2000)) return { error: "Description is required (max 2000 chars)" };
    data.description = body.description.trim();
  }
  if (!partial || has("price")) {
    const p = toNum(body.price);
    if (!Number.isFinite(p) || p < 0 || p > 1e9) return { error: "Price must be a number >= 0" };
    data.price = Math.round(p * 100) / 100;
  }
  if (!partial || has("quantity")) {
    const q = toNum(body.quantity);
    if (!Number.isInteger(q) || q < 0 || q > 1e7) return { error: "Quantity must be an integer >= 0" };
    data.quantity = q;
  }
  if (!partial || has("category")) {
    if (!isId(body.category)) return { error: "A valid category id is required" };
    if (!(await categoryModel.exists({ _id: body.category }))) return { error: "Category not found" };
    data.category = body.category;
  }
  if (file) data.photo = `/uploads/${file.filename}`;
  else if (has("photo")) {
    if (body.photo === "") data.photo = "";
    else if (typeof body.photo === "string" && isHttpUrl(body.photo) && body.photo.length <= 500) data.photo = body.photo;
    else return { error: "Photo must be an http(s) URL or an uploaded image" };
  }
  return { data };
};

const uniqueSlug = async (name, excludeId) => {
  const base = slugify(name) || "product";
  let slug = base;
  for (let i = 2; await productModel.exists({ slug, ...(excludeId && { _id: { $ne: excludeId } }) }); i++) {
    slug = `${base}-${i}`;
  }
  return slug;
};

export const createProduct = async (req, res) => {
  const cleanup = () => req.file && removeUpload(`/uploads/${req.file.filename}`);
  try {
    const { error, data } = await parseBody(req.body || {}, req.file, false);
    if (error) {
      cleanup();
      return fail(res, error);
    }
    data.slug = await uniqueSlug(data.name);
    const product = await productModel.create(data);
    res.status(201).send({ success: true, message: "Product created", product });
  } catch (error) {
    cleanup();
    serverError(res, "Error creating product", error);
  }
};

export const updateProduct = async (req, res) => {
  const cleanup = () => req.file && removeUpload(`/uploads/${req.file.filename}`);
  try {
    const { id } = req.params;
    if (!isId(id)) {
      cleanup();
      return fail(res, "Invalid product id");
    }
    const existing = await productModel.findById(id);
    if (!existing) {
      cleanup();
      return fail(res, "Product not found", 404);
    }
    const { error, data } = await parseBody(req.body || {}, req.file, true);
    if (error) {
      cleanup();
      return fail(res, error);
    }
    if (data.name && data.name !== existing.name) data.slug = await uniqueSlug(data.name, id);
    const oldPhoto = existing.photo;
    const product = await productModel.findByIdAndUpdate(id, data, { returnDocument: 'after' });
    if (data.photo !== undefined && data.photo !== oldPhoto) removeUpload(oldPhoto);
    res.send({ success: true, message: "Product updated", product });
  } catch (error) {
    cleanup();
    serverError(res, "Error updating product", error);
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return fail(res, "Invalid product id");
    const product = await productModel.findByIdAndDelete(id);
    if (!product) return fail(res, "Product not found", 404);
    removeUpload(product.photo);
    res.send({ success: true, message: "Product deleted" });
  } catch (error) {
    serverError(res, "Error deleting product", error);
  }
};

// GET /products?page=1&limit=12&search=...&category=<id or slug>&sort=newest|price_asc|price_desc
export const listProducts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const filter = {};
    if (req.query.search) {
      const s = String(req.query.search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ name: { $regex: s, $options: "i" } }, { description: { $regex: s, $options: "i" } }];
    }
    if (req.query.category) {
      const c = String(req.query.category);
      if (isId(c)) filter.category = c;
      else {
        const cat = await categoryModel.findOne({ slug: c.toLowerCase() });
        filter.category = cat ? cat._id : null;
      }
    }
    const sorts = { newest: { createdAt: -1 }, price_asc: { price: 1 }, price_desc: { price: -1 } };
    const sort = sorts[req.query.sort] || sorts.newest;
    const [total, products] = await Promise.all([
      productModel.countDocuments(filter),
      productModel.find(filter).populate("category", "name slug").sort(sort).skip((page - 1) * limit).limit(limit),
    ]);
    res.send({
      success: true,
      message: "Products fetched",
      products,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    serverError(res, "Error fetching products", error);
  }
};

export const getProductBySlug = async (req, res) => {
  try {
    const product = await productModel
      .findOne({ slug: String(req.params.slug).toLowerCase() })
      .populate("category", "name slug");
    if (!product) return fail(res, "Product not found", 404);
    res.send({ success: true, message: "Product fetched", product });
  } catch (error) {
    serverError(res, "Error fetching product", error);
  }
};
