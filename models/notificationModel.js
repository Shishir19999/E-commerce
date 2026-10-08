import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.ObjectId, ref: "users", required: true, index: true },
    type: { type: String, default: "info", maxlength: 30 },
    message: { type: String, required: true, maxlength: 300 },
    link: { type: String, default: "", maxlength: 200 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("notification", notificationSchema);
