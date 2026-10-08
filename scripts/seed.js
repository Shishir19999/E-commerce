// Idempotent, deterministic seed: node scripts/seed.js [--reset]  (or npm run seed)
// Upserts by email/slug; seed orders use fixed _ids. --reset also removes ALL orders before reseeding.
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { faker } from "@faker-js/faker";
import userModel from "../models/userModels.js";
import categoryModel from "../models/categoryModel.js";
import productModel from "../models/productModel.js";
import orderModel from "../models/orderModel.js";
import reviewModel from "../models/reviewModel.js";
import couponModel from "../models/couponModel.js";
import notificationModel from "../models/notificationModel.js";
import { SHIPPING_METHODS, orderTotal, taxAmount } from "../helpers/pricing.js";
import { slugify } from "../helpers/validate.js";

dotenv.config({ quiet: true });
faker.seed(20261001);
const PASSWORD = "Password123!";
const REF = new Date("2026-10-01T12:00:00Z").getTime();
const DAY = 86400000;
const reset = process.argv.includes("--reset");

const catalog = {
  Electronics: ["Wireless Headphones|89.99", "Smart Watch|129.00", "Portable Speaker|49.50", "4K Action Camera|159.00", "Mechanical Keyboard|74.90", "USB-C Fast Charger 65W|29.99", "Noise Cancelling Earbuds|119.00"],
  Fashion: ["Denim Jacket|64.00", "Running Sneakers|74.99", "Cotton Crew T-Shirt|14.50", "Slim Fit Chinos|39.90", "Leather Belt|22.00", "Wool Winter Scarf|19.99", "Canvas Backpack|44.00"],
  "Home & Kitchen": ["Ceramic Coffee Mug Set|24.00", "Non-stick Frying Pan|32.75", "Stainless Steel Cookware Set|119.00", "Electric Kettle 1.7L|27.50", "Bamboo Cutting Board|16.99", "Memory Foam Pillow|34.00", "Air Fryer 5L|89.00"],
  Sports: ["Yoga Mat|22.00", "Adjustable Dumbbells|139.00", "Resistance Band Set|18.99", "Insulated Water Bottle|21.50", "Jump Rope Pro|11.99", "Trail Running Hydration Vest|59.00", "Foam Roller|25.00"],
  Books: ["Mastering JavaScript|39.00", "The Pragmatic Programmer|44.95", "Atomic Habits|16.50", "Cooking Basics Cookbook|27.00", "World Atlas Illustrated|35.00", "Introduction to Algorithms|89.00", "Mindfulness in Plain English|13.99"],
  Beauty: ["Vitamin C Serum|18.50", "Hydrating Moisturizer|15.99", "Mineral Sunscreen SPF50|17.25", "Argan Oil Shampoo|12.49", "Matte Lipstick Set|21.00", "Charcoal Face Mask|9.99", "Electric Facial Brush|36.00"],
  "Toys & Games": ["Building Blocks 500 pcs|29.99", "Remote Control Car|42.00", "Strategy Board Game|34.50", "Plush Teddy Bear|18.00", "1000-piece Jigsaw Puzzle|15.99", "Wooden Train Set|38.00", "Kids Science Kit|26.50"],
  "Garden & Outdoor": ["Cordless Hedge Trimmer|98.00", "Garden Tool Set|31.99", "4-Person Camping Tent|129.00", "Solar Path Lights 8-pack|35.00", "Folding Camp Chair|24.99", "Watering Hose 25m|27.00", "Ceramic Planter Pot|19.50"],
  "Pet Supplies": ["Orthopedic Dog Bed|49.00", "Cat Scratching Tree|58.00", "Automatic Pet Feeder|64.99", "Retractable Dog Leash|14.99", "Premium Dry Dog Food 5kg|36.50", "Interactive Cat Toy Set|12.99", "Stainless Pet Bowl Pair|13.50"],
  "Office Supplies": ["Ergonomic Office Chair|189.00", "Standing Desk Converter|149.00", "Gel Pen Set 24 pcs|9.49", "A5 Hardcover Notebook|7.99", "Desk Organizer|17.99", "LED Desk Lamp|28.00", "Laser Printer Paper 500 sheets|8.75"],
  "Health & Wellness": ["Digital Blood Pressure Monitor|45.00", "Multivitamin 120 tablets|19.99", "Whey Protein 1kg|39.00", "Essential Oil Diffuser|26.00", "Smart Bathroom Scale|32.00", "Herbal Sleep Tea 20 bags|6.99", "Massage Gun|79.00"],
  Automotive: ["Dash Camera 1080p|69.00", "Car Phone Mount|13.99", "Portable Tire Inflator|39.50", "Microfiber Cleaning Kit|16.50", "Jump Starter 12V|74.00", "Seat Cover Set|52.00", "LED Headlight Bulbs|31.00"],
};
const blurbs = ["Built for everyday use with durable materials.", "Highly rated by customers for quality and value.", "Comes with a 12-month limited warranty.", "Lightweight, practical and easy to maintain.", "A best seller in its category this season.", "Designed with comfort and reliability in mind."];

await mongoose.connect(process.env.MONGODB_URL);
const hash = await bcrypt.hash(PASSWORD, 10);

// users
const userDefs = [
  { name: "Admin User", email: "admin@example.com", role: 1 },
  { name: "Demo User", email: "user@example.com", role: 0 },
  { name: "Store Manager", email: "manager@example.com", role: 1 },
];
const seen = new Set(userDefs.map((u) => u.email));
while (userDefs.length < 25) {
  const first = faker.person.firstName(), last = faker.person.lastName();
  const email = `${slugify(first)}.${slugify(last)}@example.com`;
  if (seen.has(email)) continue;
  seen.add(email);
  userDefs.push({ name: `${first} ${last}`, email, role: 0 });
}
const users = [];
for (const u of userDefs) {
  const phone = "98" + faker.string.numeric(8);
  const address = `${faker.location.streetAddress()}, ${faker.location.city()}`;
  const r = await userModel.findOneAndUpdate(
    { email: u.email },
    { $set: { name: u.name, role: u.role }, $setOnInsert: { password: hash, phone, address } },
    { upsert: true, returnDocument: 'after' }
  );
  users.push(r);
}

// sellers (role 2) and one pending seller application
const sellerDefs = [
  { name: "Demo Seller", email: "seller@example.com", storeName: "Northwind Goods" },
  { name: "Orchard Owner", email: "orchard@example.com", storeName: "Orchard & Co" },
];
const sellers = [];
for (const s of sellerDefs) {
  sellers.push(await userModel.findOneAndUpdate(
    { email: s.email },
    { $set: { name: s.name, role: 2, storeName: s.storeName, sellerRequest: false }, $setOnInsert: { password: hash, phone: "98" + faker.string.numeric(8), address: `${faker.location.streetAddress()}, ${faker.location.city()}` } },
    { upsert: true, returnDocument: "after" }
  ));
}
await userModel.updateOne({ _id: users[3]._id }, { $set: { sellerRequest: true, storeName: "Corner Crafts" } });
// the demo customer has a small address book
await userModel.updateOne({ email: "user@example.com" }, { $set: { addresses: [
  { label: "Home", name: "Demo User", phone: "9800000001", street: "24 Maple Avenue", city: "Springfield", zip: "62704", isDefault: true },
  { label: "Work", name: "Demo User", phone: "9800000001", street: "1 Market Street, Floor 4", city: "Springfield", zip: "62701", isDefault: false },
] } });

// categories + products
const catIds = {};
for (const name of Object.keys(catalog)) {
  const slug = slugify(name);
  const c = await categoryModel.findOneAndUpdate({ slug }, { $set: { name }, $setOnInsert: { slug } }, { upsert: true, returnDocument: 'after' });
  catIds[name] = c._id;
}
const prodDefs = [];
for (const [cat, list] of Object.entries(catalog)) {
  for (const item of list) {
    const [name, p] = item.split("|");
    prodDefs.push({ name, slug: slugify(name), cat, price: Number(p), stock: faker.number.int({ min: 40, max: 200 }),
      description: `${name} from our ${cat} range. ${faker.helpers.arrayElement(blurbs)} ${faker.helpers.arrayElement(blurbs)}` });
  }
}

// orders (deterministic ids); product stock = initial stock - units in non-cancelled orders
const statuses = ["Delivered", "Delivered", "Delivered", "Shipped", "Shipped", "Processing", "Processing", "Not Processed", "Cancelled"];
const timelineFor = (status, at) => {
  const flow = ["Not Processed", "Processing", "Shipped", "Delivered"];
  const notes = ["Order placed", "Being packed", "Handed to the carrier", "Delivered to the address"];
  const steps = status === "Cancelled" ? [{ status: "Not Processed", note: notes[0] }, { status: "Cancelled", note: "Cancelled" }] : flow.slice(0, flow.indexOf(status) + 1).map((st, i) => ({ status: st, note: notes[i] }));
  return steps.map((t, i) => ({ ...t, at: new Date(at.getTime() + i * 86400000) }));
};
const orderDocs = [];
for (let i = 0; i < 60; i++) {
  const u = users[faker.number.int({ min: 1, max: users.length - 1 })];
  const picks = faker.helpers.arrayElements(prodDefs, faker.number.int({ min: 1, max: 4 }));
  const items = picks.map((p) => ({ prod: p, name: p.name, price: p.price, quantity: faker.number.int({ min: 1, max: 3 }) }));
  const total = Math.round(items.reduce((s, x) => s + x.price * x.quantity, 0) * 100) / 100; // item subtotal (shipping and tax are added on insert)
  const createdAt = new Date(REF - faker.number.int({ min: 1, max: 120 }) * DAY - faker.number.int({ min: 0, max: 80000 }) * 1000);
  orderDocs.push({ _id: new mongoose.Types.ObjectId(("e0c0" + String(i).padStart(4, "0")).padEnd(24, "0")), u, items, total, createdAt, status: faker.helpers.arrayElement(statuses) });
}
const sold = {};
for (const o of orderDocs) if (o.status !== "Cancelled") for (const it of o.items) sold[it.prod.slug] = (sold[it.prod.slug] || 0) + it.quantity;

const pid = {};
const sellerOf = {};
const variantsFor = (cat) =>
  cat === "Fashion" ? [{ name: "Size", options: ["S", "M", "L", "XL"] }, { name: "Color", options: ["Black", "Navy", "Sand"] }]
  : cat === "Electronics" ? [{ name: "Color", options: ["Black", "Silver", "White"] }]
  : [];
let n = 0;
for (const p of prodDefs) {
  const img = (i) => `https://picsum.photos/seed/${p.slug}-${i}/600/600`;
  const r = await productModel.findOneAndUpdate(
    { slug: p.slug },
    {
      $set: {
        name: p.name, description: p.description, price: p.price, category: catIds[p.cat],
        photo: img(0), images: [img(1), img(2), img(3)],
        variants: variantsFor(p.cat), featured: n % 6 === 0, compareAtPrice: n % 4 === 0 ? Math.round(p.price * 1.25 * 100) / 100 : 0,
        quantity: Math.max(0, p.stock - (sold[p.slug] || 0)), sold: sold[p.slug] || 0,
        seller: n % 3 === 1 ? sellers[0]._id : n % 3 === 2 ? sellers[1]._id : null, // every third product is sold by the store itself
      },
      $setOnInsert: { slug: p.slug },
    },
    { upsert: true, returnDocument: 'after' }
  );
  pid[p.slug] = r._id;
  sellerOf[p.slug] = r.seller;
  n++;
}

// coupons
for (const c of [
  { code: "WELCOME10", description: "10% off your order", type: "percent", value: 10, minSubtotal: 0 },
  { code: "SAVE5", description: "$5 off orders over $40", type: "fixed", value: 5, minSubtotal: 40 },
  { code: "BIGSPEND25", description: "25% off orders over $150", type: "percent", value: 25, minSubtotal: 150 },
]) await couponModel.updateOne({ code: c.code }, { $set: { ...c, active: true } }, { upsert: true });

// reviews (deterministic) and rating aggregates
const comments = ["Great quality for the price.", "Arrived quickly and works as described.", "Good, but the packaging could be better.", "Exactly what I needed.", "Solid build and easy to use.", "Would buy again."];
await reviewModel.deleteMany({});
const reviewDocs = [];
for (const p of prodDefs) {
  const authors = faker.helpers.arrayElements(users.slice(1), faker.number.int({ min: 1, max: 5 }));
  for (const u of authors)
    reviewDocs.push({
      product: pid[p.slug], user: u._id, userName: u.name,
      rating: faker.helpers.weightedArrayElement([{ weight: 1, value: 2 }, { weight: 2, value: 3 }, { weight: 5, value: 4 }, { weight: 6, value: 5 }]),
      comment: faker.helpers.arrayElement(comments), verified: faker.datatype.boolean(),
    });
}
await reviewModel.insertMany(reviewDocs);
const aggs = await reviewModel.aggregate([{ $group: { _id: "$product", avg: { $avg: "$rating" }, n: { $sum: 1 } } }]);
for (const a of aggs) await productModel.updateOne({ _id: a._id }, { rating: Math.round(a.avg * 10) / 10, numReviews: a.n });

if (reset) await orderModel.deleteMany({});
else await orderModel.collection.deleteMany({ _id: { $in: orderDocs.map((o) => o._id) } });
// two delivered orders get return requests: one open, one approved (refunded)
const delivered = orderDocs.filter((o) => o.status === "Delivered");
const openReturn = delivered[0], doneReturn = delivered[1];
// the demo customer owns two delivered orders (one can be returned right away)
delivered[2].u = users[1];
delivered[3].u = users[1];
// these four are recent (relative to today) so the return window is open when you try it
[delivered[0], delivered[1], delivered[2], delivered[3]].forEach((o, i) => (o.createdAt = new Date(Date.now() - (9 - i * 2) * DAY)));
await orderModel.collection.insertMany(orderDocs.map((o) => {
  const tax = taxAmount(o.total, 0);
  const shipping = o.total >= 50 ? 0 : SHIPPING_METHODS.standard.cost;
  const status = o === doneReturn ? "Returned" : o.status;
  const timeline = timelineFor(o.status, o.createdAt);
  const last = timeline[timeline.length - 1].at;
  let returnRequest;
  if (o === openReturn) {
    returnRequest = { status: "requested", reason: "The size is too small for me.", requestedAt: new Date(last.getTime() + 86400000) };
    timeline.push({ status: "Return requested", note: returnRequest.reason, at: returnRequest.requestedAt });
  } else if (o === doneReturn) {
    returnRequest = { status: "approved", reason: "Arrived with a scratch on the side.", requestedAt: new Date(last.getTime() + 86400000), resolvedAt: new Date(last.getTime() + 2 * 86400000), note: "Refund issued" };
    timeline.push({ status: "Return requested", note: returnRequest.reason, at: returnRequest.requestedAt }, { status: "Returned", note: "Refund issued", at: returnRequest.resolvedAt });
  }
  return {
    _id: o._id, user: o.u._id,
    items: o.items.map((x) => ({ _id: new mongoose.Types.ObjectId(), product: pid[x.prod.slug], name: x.name, price: x.price, quantity: x.quantity, variant: "", photo: `https://picsum.photos/seed/${x.prod.slug}-0/600/600`, seller: sellerOf[x.prod.slug] || null })),
    subtotal: o.total, discount: 0, shipping, tax, total: orderTotal(o.total, 0, shipping, tax), shippingMethod: "standard", shippingAddress: o.u.address, status,
    trackingNumber: ["Shipped", "Delivered"].includes(o.status) ? `TRK-${String(500000 + Number(o._id.toString().slice(-4)))}` : "",
    timeline,
    ...(returnRequest ? { returnRequest } : {}),
    payment: { method: "mock", status: o.status === "Cancelled" || status === "Returned" ? "refunded (mock)" : "paid (mock)" },
    createdAt: o.createdAt, updatedAt: new Date(o.createdAt.getTime() + 3600000), __v: 0,
  };
}));
// a Returned order no longer counts as sold stock
const dr = doneReturn.items;
for (const it of dr) await productModel.updateOne({ slug: it.prod.slug }, { $inc: { sold: -it.quantity, quantity: it.quantity } });

// starter notifications (replaced on every run)
await notificationModel.deleteMany({});
const demoUser = users.find((u) => u.email === "user@example.com");
const adminUser = users.find((u) => u.email === "admin@example.com");
const sid = (o) => String(o._id).slice(-6).toUpperCase();
await notificationModel.insertMany([
  { user: demoUser._id, type: "order", message: "Welcome to ShopLane! Order updates will show up here.", link: "/orders" },
  { user: adminUser._id, type: "return", message: `Return requested for order #${sid(openReturn)}`, link: "/admin/orders" },
  { user: adminUser._id, type: "seller", message: "Corner Crafts applied to become a seller", link: "/admin/users" },
  { user: sellers[0]._id, type: "order", message: "New orders are waiting to be shipped", link: "/seller/orders" },
  { user: sellers[0]._id, type: "stock", message: "Low stock: check your products with 10 or fewer units", link: "/seller/products" },
]);

console.log(`Seeded: ${await userModel.countDocuments()} users, ${await categoryModel.countDocuments()} categories, ${await productModel.countDocuments()} products, ${await orderModel.countDocuments()} orders`);
console.log("Coupons: WELCOME10, SAVE5 (min $40), BIGSPEND25 (min $150)");
console.log(`Logins (password ${PASSWORD}): admin@example.com and manager@example.com (admins), seller@example.com and orchard@example.com (sellers), user@example.com (customer)`);
await mongoose.disconnect();
