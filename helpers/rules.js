// Business rules shared by the API and the in-browser live preview (Client/src/lib/rules.js is a byte-for-byte copy,
// checked by a test). No imports on purpose.
export const ROLE = { CUSTOMER: 0, ADMIN: 1, SELLER: 2 };
export const ROLE_NAMES = { 0: "Customer", 1: "Admin", 2: "Seller" };

export const ORDER_STATUSES = ["Not Processed", "Processing", "Shipped", "Delivered", "Cancelled", "Returned"];
// statuses that can be set by hand (Returned is only reached through an approved return request)
export const SETTABLE_STATUSES = ["Not Processed", "Processing", "Shipped", "Delivered", "Cancelled"];
export const FLOW = ["Not Processed", "Processing", "Shipped", "Delivered"];
// what a seller may move an order to (forward only)
export const SELLER_STATUSES = ["Processing", "Shipped", "Delivered"];
export const CANCELLABLE = ["Not Processed", "Processing"];

export const LOW_STOCK = 10;
export const RETURN_WINDOW_DAYS = 30;
export const MAX_ADDRESSES = 8;

// Returns { ok, reason }.
export const returnEligibility = (order, now = Date.now()) => {
  if (order.returnRequest && order.returnRequest.status) return { ok: false, reason: "A return was already requested for this order" };
  if (order.status !== "Delivered") return { ok: false, reason: "Only delivered orders can be returned" };
  const t = [...(order.timeline || [])].reverse().find((x) => x.status === "Delivered");
  const at = new Date(t ? t.at : order.updatedAt || order.createdAt).getTime();
  if (now - at > RETURN_WINDOW_DAYS * 86400000) return { ok: false, reason: `The ${RETURN_WINDOW_DAYS}-day return window has passed` };
  return { ok: true, reason: "" };
};

// Seller move rules: forward only along FLOW, never from a closed order. Returns an error message or "".
export const sellerStatusError = (current, next) => {
  if (!SELLER_STATUSES.includes(next)) return "Sellers can set Processing, Shipped or Delivered";
  if (["Cancelled", "Returned"].includes(current)) return "This order is closed";
  if (FLOW.indexOf(next) <= FLOW.indexOf(current)) return "Orders can only move forward";
  return "";
};

// Address-book / checkout address validation. Returns an object of field errors (empty when valid).
export const validateAddress = (a) => {
  const s = (v) => (typeof v === "string" ? v.trim() : "");
  const e = {};
  if (s(a?.name).length < 2) e.name = "Enter your full name";
  if (s(a?.phone).replace(/\D/g, "").length < 7) e.phone = "Enter a phone number with at least 7 digits";
  if (s(a?.street).length < 3) e.street = "Enter your street address";
  if (s(a?.city).length < 2) e.city = "Enter your city";
  if (s(a?.zip).length < 3) e.zip = "Enter your postal code";
  if (a?.label !== undefined && a.label !== "" && (typeof a.label !== "string" || a.label.trim().length > 30)) e.label = "Label can be at most 30 characters";
  for (const k of ["name", "phone", "street", "city", "zip"]) if (!e[k] && s(a?.[k]).length > 120) e[k] = "Too long";
  return e;
};

export const formatAddress = (a) => `${a.name}, ${a.street}, ${a.city} ${a.zip}, Tel ${a.phone}`;
