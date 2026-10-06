import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString("hex") + ALLOWED[file.mimetype]),
  }),
  limits: { fileSize: 1024 * 1024, files: 1 }, // 1 MB
  fileFilter: (req, file, cb) =>
    ALLOWED[file.mimetype] ? cb(null, true) : cb(new Error("Only jpg, png, webp or gif images are allowed")),
});

// wraps multer so upload errors become consistent JSON 400s
export const uploadPhoto = (req, res, next) =>
  upload.single("photo")(req, res, (err) => {
    if (err) return res.status(400).send({ success: false, message: err.message });
    next();
  });
