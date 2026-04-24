const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const app = express();

/* ================= CONFIG ================= */
const MONGO_URI = "mongodb+srv://clothify:clothify123@cluster0.poqm1ah.mongodb.net/clothify_db";
const JWT_SECRET = "clothify-secret-key-2026";

/* ================= IMPORT MODELS ================= */
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Coupon = require("../models/Coupon");
const Category = require("../models/Category");

/* ================= RAZORPAY CONFIG ================= */
const razorpay = new Razorpay({
    key_id: "rzp_test_SddwuohfBT0WW9",
    key_secret: "GsLaryF3VtGUK4iah79881dJ"
});

/* ================= MIDDLEWARE ================= */
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Vercel pathing for static files
app.use(express.static(path.join(process.cwd(), "public")));

/* ================= DB CONNECTION LOGIC (Vercel Ready) ================= */
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ MongoDB Connected");
    } catch (err) {
        console.error("❌ MongoDB Error:", err.message);
    }
};

app.use(async (req, res, next) => {
    await connectDB();
    next();
});

/* ================= AUTH MIDDLEWARE ================= */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(403).json({ error: "Invalid or expired token" });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Unauthorized" });
    next();
};

/* ================= ROUTES ================= */

// AUTH: Signup
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ success: false, message: "Email registered" });

        const user = new User({ firstName, lastName, email, password, role: "user" });
        await user.save();

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
        res.status(201).json({ success: true, token, user: { name: user.firstName } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Signup failed" });
    }
});

// AUTH: Login
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }
        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
        res.json({ success: true, token, user: { name: user.firstName, role: user.role } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Login failed" });
    }
});

// PRODUCTS: Get all
app.get("/api/products", async (req, res) => {
    try {
        const products = await Product.find().populate("category").sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: "Error fetching products" });
    }
});

// PAYMENTS: Create Razorpay Order
app.post("/api/payment/create-order", async (req, res) => {
    try {
        const options = { amount: req.body.amount * 100, currency: "INR" };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: "Payment creation failed" });
    }
});

// PAYMENTS: Verify Signature
app.post("/api/payment/verify", (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac("sha256", "GsLaryF3VtGUK4iah79881dJ")
        .update(body)
        .digest("hex");

    res.json({ success: expectedSignature === razorpay_signature });
});

// FALLBACK: Serve Frontend
app.get("*", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

/* ================= EXPORT ================= */
module.exports = app;
