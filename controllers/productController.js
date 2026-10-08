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

// admins manage everything; sellers only their own products
const ownsProduct = (user, product) => user.role === 1 || (user.role === 2 && product.seller && String(product.seller) === String(user._id));
export const SELLER_FIELDS = "name storeName";

const isHttpUrl = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const parseJson = (v, fallback) => {
  if (Array.isArray(v)) return v;
  if (typeof v !== "string") return fallback;
  if (v === "") return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return null;
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
  if (!partial || has("compareAtPrice")) {
    const c = body.compareAtPrice === undefined || body.compareAtPrice === "" ? 0 : toNum(body.compareAtPrice);
    if (!Number.isFinite(c) || c < 0 || c > 1e9) return { error: "Compare-at price must be a number >= 0" };
    if (has("compareAtPrice") || !partial) data.compareAtPrice = Math.round(c * 100) / 100;
  }
  if (has("featured")) data.featured = body.featured === true || body.featured === "true";
  if (has("images")) {
    const imgs = parseJson(body.images, []);
    if (!Array.isArray(imgs) || imgs.length > 8 || !imgs.every((u) => typeof u === "string" && u.length <= 500 && (isHttpUrl(u) || u.startsWith("/uploads/"))))
      return { error: "Images must be a list of up to 8 http(s) URLs" };
    data.images = imgs;
  }
  if (has("variants")) {
    const v = parseJson(body.variants, []);
    const okOpt = (o) => Array.isArray(o) && o.length > 0 && o.length <= 12 && o.every((x) => isStr(x, 1, 30));
    if (!Array.isArray(v) || v.length > 4 || !v.every((x) => x && isStr(x.name, 1, 30) && okOpt(x.options)))
      return { error: "Variants must be up to 4 groups, each with a name and 1-12 options" };
    data.variants = v.map((x) => ({ name: x.name.trim(), options: x.options.map((o) => o.trim()) }));
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
    if (req.user.role === 2) delete data.featured; // only admins feature products
    if (req.user.role === 2) data.seller = req.user._id; // sellers always own what they create
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
    if (!ownsProduct(req.user, existing)) {
      cleanup();
      return fail(res, "You can only manage your own products", 403);
    }
    const { error, data } = await parseBody(req.body || {}, req.file, true);
    if (error) {
      cleanup();
      return fail(res, error);
    }
    if (req.user.role === 2) delete data.featured;
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
    const found = await productModel.findById(id);
    if (!found) return fail(res, "Product not found", 404);
    if (!ownsProduct(req.user, found)) return fail(res, "You can only manage your own products", 403);
    const product = await productModel.findByIdAndDelete(id);
    removeUpload(product.photo);
    res.send({ success: true, message: "Product deleted" });
  } catch (error) {
    serverError(res, "Error deleting product", error);
  }
};

// GET /products?page=1&limit=12&search=...&category=<id or slug>&sort=newest|price_asc|price_desc|rating|popular|name
//   &minPrice=&maxPrice=&minRating=&inStock=true&featured=true&ids=a,b,c
export const listProducts = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page) || 1);
    const limit = Math.min(60, Math.max(1, Number.parseInt(req.query.limit) || 12));
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
    const price = {};
    const min = toNum(req.query.minPrice);
    const max = toNum(req.query.maxPrice);
    if (Number.isFinite(min)) price.$gte = min;
    if (Number.isFinite(max)) price.$lte = max;
    if (Object.keys(price).length) filter.price = price;
    const minRating = toNum(req.query.minRating);
    if (Number.isFinite(minRating) && minRating > 0) filter.rating = { $gte: minRating };
    if (req.query.inStock === "true") filter.quantity = { $gt: 0 };
    if (req.query.featured === "true") filter.featured = true;
    if (req.query.seller) {
      if (req.query.seller === "store") filter.seller = null;
      else if (isId(String(req.query.seller))) filter.seller = req.query.seller;
    }
    if (req.query.ids) {
      const ids = String(req.query.ids).split(",").filter(isId).slice(0, 50);
      filter._id = { $in: ids };
    }
    const sorts = {
      newest: { createdAt: -1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      rating: { rating: -1, numReviews: -1 },
      popular: { sold: -1 },
      name: { name: 1 },
    };
    const sort = sorts[req.query.sort] || sorts.newest;
    const [total, products, top] = await Promise.all([
      productModel.countDocuments(filter),
      productModel.find(filter).populate("category", "name slug").populate("seller", SELLER_FIELDS).sort(sort).skip((page - 1) * limit).limit(limit),
      productModel.findOne().sort({ price: -1 }).select("price"),
    ]);
    res.send({
      success: true,
      message: "Products fetched",
      products,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      maxPrice: top ? Math.ceil(top.price) : 0,
    });
  } catch (error) {
    serverError(res, "Error fetching products", error);
  }
};

export const getProductBySlug = async (req, res) => {
  try {
    const product = await productModel
      .findOne({ slug: String(req.params.slug).toLowerCase() })
      .populate("category", "name slug")
      .populate("seller", SELLER_FIELDS);
    if (!product) return fail(res, "Product not found", 404);
    res.send({ success: true, message: "Product fetched", product });
  } catch (error) {
    serverError(res, "Error fetching product", error);
  }
};

// GET /products/:slug/related: same category first, best rated first
export const relatedProducts = async (req, res) => {
  try {
    const product = await productModel.findOne({ slug: String(req.params.slug).toLowerCase() });
    if (!product) return fail(res, "Product not found", 404);
    const products = await productModel
      .find({ category: product.category, _id: { $ne: product._id } })
      .populate("category", "name slug")
      .populate("seller", SELLER_FIELDS)
      .sort({ rating: -1, sold: -1 })
      .limit(4);
    res.send({ success: true, message: "Related products fetched", products });
  } catch (error) {
    serverError(res, "Error fetching related products", error);
  }
};
