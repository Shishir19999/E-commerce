import mongoose from "mongoose";

export const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const isId = (v) => typeof v === "string" && mongoose.isValidObjectId(v);

export const isStr = (v, min = 1, max = 200) =>
  typeof v === "string" && v.trim().length >= min && v.trim().length <= max;

export const fail = (res, message, status = 400) => res.status(status).send({ success: false, message });

export const serverError = (res, message, error) => {
  console.log(error);
  return res.status(500).send({ success: false, message });
};

// accept a number or numeric string
export const toNum = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));
