import express from "express";
import morgan from "morgan";
import cors from "cors";
import path from "path";
import authRoute from "./routes/authRoute.js";
import categoryRoute from "./routes/categoryRoute.js";
import productRoute from "./routes/productRoute.js";
import orderRoute from "./routes/orderRoute.js";
import paymentRoute from "./routes/paymentRoute.js";
import { webhook } from "./controllers/paymentController.js";

// Express app only (no DB connection / listen) so tests can import it.
const app = express();

app.use(cors());
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

// Stripe webhook needs the raw body for signature verification: mount before express.json()
app.post("/api/v1/payments/webhook", express.raw({ type: "application/json" }), webhook);

app.use(express.json());

app.use("/api/v1/auth", authRoute);
app.use("/api/v1/categories", categoryRoute);
app.use("/api/v1/products", productRoute);
app.use("/api/v1/orders", orderRoute);
app.use("/api/v1/payments", paymentRoute);
//uploaded product photos
app.use("/uploads", express.static(path.resolve(process.env.UPLOAD_DIR || "uploads")));

app.get("/", (req, res) => {
  res.send("<h1>welcome</h1>");
});

//consistent JSON for malformed bodies / unexpected errors
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).send({ success: false, message: status < 500 ? "Invalid request body" : "Server error" });
});

export default app;
