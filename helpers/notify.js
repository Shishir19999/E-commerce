import notificationModel from "../models/notificationModel.js";
import userModel from "../models/userModels.js";

// Creates in-app notifications. Never throws: a failed notification must not break the action that caused it.
export const notify = async (userIds, { type = "info", message, link = "" }) => {
  try {
    const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).map(String))];
    if (!ids.length) return;
    await notificationModel.insertMany(ids.map((user) => ({ user, type, message, link })));
  } catch (e) {
    console.log("notify failed", e.message);
  }
};

export const adminIds = async () => (await userModel.find({ role: 1 }).select("_id")).map((u) => u._id);
