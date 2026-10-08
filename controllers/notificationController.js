import notificationModel from "../models/notificationModel.js";
import { fail, isId, serverError } from "../helpers/validate.js";

// GET /notifications -> latest 30 plus the unread count
export const listNotifications = async (req, res) => {
  try {
    const [notifications, unread] = await Promise.all([
      notificationModel.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30),
      notificationModel.countDocuments({ user: req.user._id, read: false }),
    ]);
    res.send({ success: true, message: "Notifications fetched", notifications, unread });
  } catch (error) {
    serverError(res, "Error fetching notifications", error);
  }
};

export const markRead = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, "Invalid notification id");
    const n = await notificationModel.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true }, { returnDocument: "after" });
    if (!n) return fail(res, "Notification not found", 404);
    res.send({ success: true, message: "Marked as read", notification: n });
  } catch (error) {
    serverError(res, "Error updating notification", error);
  }
};

export const markAllRead = async (req, res) => {
  try {
    await notificationModel.updateMany({ user: req.user._id, read: false }, { read: true });
    res.send({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    serverError(res, "Error updating notifications", error);
  }
};

export const clearNotifications = async (req, res) => {
  try {
    await notificationModel.deleteMany({ user: req.user._id });
    res.send({ success: true, message: "Notifications cleared" });
  } catch (error) {
    serverError(res, "Error clearing notifications", error);
  }
};
