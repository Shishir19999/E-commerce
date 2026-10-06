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
const orderDocs = [];
for (let i = 0; i < 60; i++) {
  const u = users[faker.number.int({ min: 1, max: users.length - 1 })];
  const picks = faker.helpers.arrayElements(prodDefs, faker.number.int({ min: 1, max: 4 }));
  const items = picks.map((p) => ({ prod: p, name: p.name, price: p.price, quantity: faker.number.int({ min: 1, max: 3 }) }));
  const total = Math.round(items.reduce((s, x) => s + x.price * x.quantity, 0) * 100) / 100;
  const createdAt = new Date(REF - faker.number.int({ min: 1, max: 120 }) * DAY - faker.number.int({ min: 0, max: 80000 }) * 1000);
  orderDocs.push({ _id: new mongoose.Types.ObjectId(("e0c0" + String(i).padStart(4, "0")).padEnd(24, "0")), u, items, total, createdAt, status: faker.helpers.arrayElement(statuses) });
}
const sold = {};
for (const o of orderDocs) if (o.status !== "Cancelled") for (const it of o.items) sold[it.prod.slug] = (sold[it.prod.slug] || 0) + it.quantity;

const pid = {};
for (const p of prodDefs) {
  const r = await productModel.findOneAndUpdate(
    { slug: p.slug },
    { $set: { name: p.name, description: p.description, price: p.price, category: catIds[p.cat], photo: `https://picsum.photos/seed/${p.slug}/600/600`, quantity: Math.max(0, p.stock - (sold[p.slug] || 0)) }, $setOnInsert: { slug: p.slug } },
    { upsert: true, returnDocument: 'after' }
  );
  pid[p.slug] = r._id;
}

if (reset) await orderModel.deleteMany({});
else await orderModel.collection.deleteMany({ _id: { $in: orderDocs.map((o) => o._id) } });
await orderModel.collection.insertMany(orderDocs.map((o) => ({
  _id: o._id, user: o.u._id,
  items: o.items.map((x) => ({ _id: new mongoose.Types.ObjectId(), product: pid[x.prod.slug], name: x.name, price: x.price, quantity: x.quantity })),
  total: o.total, shippingAddress: o.u.address, status: o.status,
  payment: { method: "mock", status: o.status === "Cancelled" ? "refunded (mock)" : "paid (mock)" },
  createdAt: o.createdAt, updatedAt: new Date(o.createdAt.getTime() + 3600000), __v: 0,
})));

console.log(`Seeded: ${await userModel.countDocuments()} users, ${await categoryModel.countDocuments()} categories, ${await productModel.countDocuments()} products, ${await orderModel.countDocuments()} orders`);
console.log(`Demo logins (password ${PASSWORD}): admin@example.com (admin), manager@example.com (admin), user@example.com`);
await mongoose.disconnect();
