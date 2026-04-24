const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const Razorpay = require("razorpay");

const app = express();
/* ================= CONFIG ================= */
const PORT = 5000;
const MONGO_URI = "mongodb+srv://clothify:clothify123@cluster0.poqm1ah.mongodb.net/clothify_db";
const JWT_SECRET = "clothify-secret-key-2026";

/* ================= IMPORT MODELS ================= */
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Coupon = require("../models/Coupon");
const Category = require("../models/Category");


/* ================= MIDDLEWARE ================= */
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

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
    if (req.user.role !== "admin") return res.status(403).json({ error: "Unauthorized: Admin access required" });
    next();
};

const razorpay = new Razorpay({
  key_id: "rzp_test_SddwuohfBT0WW9",
  key_secret: "GsLaryF3VtGUK4iah79881dJ"
});


/* ================= AUTH ROUTES ================= */
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ success: false, message: "Email already registered" });

        const user = new User({ firstName, lastName, email, password, role: "user" });
        await user.save();

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
        res.status(201).json({ success: true, token, user: { name: user.firstName, email: user.email } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Signup failed" });
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }
        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
        res.json({ success: true, token, user: { name: user.firstName, role: user.role } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Login failed" });
    }
});

/* ================= PRODUCT ROUTES ================= */
app.get("/api/products", async (req, res) => {
    try {
        const products = await Product.find()
            .populate("category") // This converts ID to an Object { name, _id }
            .sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: "Error fetching products" });
    }
});

app.post("/api/products", authenticateToken, isAdmin, async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (err) {
        res.status(500).json({ error: "Failed to add product" });
    }
});

// 1. Update the GET route
app.get("/api/products", async (req, res) => {
    try {
        const products = await Product.find()
            .populate("category") // This converts ID to an Object { name, _id }
            .sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: "Error fetching products" });
    }
});

// 2. Update the PUT route
app.put("/api/products/:id", authenticateToken, isAdmin, async (req, res) => {
    try {
        // ... (your existing validation code)
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        ).populate("category"); // This ensures the response contains the category name

        if (!product) return res.status(404).json({ error: "Product not found" });
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/products/:id", authenticateToken, isAdmin, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Product deleted" });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

/* ================= ORDER ROUTES ================= */
// Admin: Get all orders
app.get("/api/orders", authenticateToken, isAdmin, async (req, res) => {
    const orders = await Order.find().populate("userId", "firstName lastName email").sort({ createdAt: -1 });
    res.json(orders);
});

// User: Get own orders
app.get('/api/orders/my-orders', authenticateToken, async (req, res) => {
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(orders);
});

// User: Checkout
app.post("/api/orders", authenticateToken, async (req, res) => {
    try {
        const { items, total, paymentMethod, shippingDetails, paymentDetails, paymentStatus } = req.body;

        // 1. Validation Check
        if (!items || items.length === 0) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        // 2. Inventory Check & Stock Preparation
        const productsToUpdate = [];
        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product || product.stock < item.quantity) {
                return res.status(400).json({ message: `Stock unavailable for ${item.name}` });
            }
            product.stock -= item.quantity;
            productsToUpdate.push(product);
        }

        // 3. Create Order Object 
        // Ensure keys match your Schema exactly!
        const order = new Order({
            userId: req.user.id,
            orderId: "CLOTH-" + Math.random().toString(36).toUpperCase().substring(2, 10),
            items,
            total,
            paymentMethod: paymentMethod.toLowerCase(), // Force lowercase to match enum
            shippingDetails,
            paymentStatus: paymentStatus || "pending",
            paymentDetails: paymentDetails || {},
            status: "Processing"
        });

        // 4. Save Order
        await order.save();

        // 5. Update Stock only after order is confirmed
        await Promise.all(productsToUpdate.map(p => p.save()));

        res.status(201).json({ success: true, order });

    } catch (err) {
        // 🔥 THIS LOG IS CRUCIAL: It will tell you exactly which field failed validation
        console.error("Mongoose Validation Error:", err.message);
        
        res.status(400).json({ 
            success: false, 
            message: "Validation Error: " + err.message 
        });
    }
});

// Admin: Update Status
app.patch("/api/orders/:id/status", authenticateToken, isAdmin, async (req, res) => {
    const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json(order);
});

/* ================= COUPON ROUTES (FIXED) ================= */

// ADMIN: Get all coupons
app.get("/api/coupons", authenticateToken, isAdmin, async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.json(coupons);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch coupons" });
    }
});

// ADMIN: Create coupon
app.post('/api/coupons', authenticateToken, isAdmin, async (req, res) => {
    try {
        const newCoupon = new Coupon(req.body);
        await newCoupon.save();
        res.status(201).json(newCoupon);
    } catch (err) {
        res.status(400).json({ message: "Duplicate code or invalid data" });
    }
});

// ADMIN: Delete coupon
app.delete("/api/coupons/:id", authenticateToken, isAdmin, async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ message: "Coupon removed" });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

// PUBLIC: Validate coupon for checkout
app.post("/api/coupons/validate", async (req, res) => {
    const { code, cartTotal } = req.body;
    try {
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

        if (!coupon) return res.status(404).json({ message: "Invalid coupon" });
        if (new Date() > coupon.expiryDate) return res.status(400).json({ message: "This coupon has expired" });
        if (cartTotal < coupon.minOrder) return res.status(400).json({ message: `Minimum order of ₹${coupon.minOrder} required` });

        // Return maxdiscount so the frontend can cap the savings
        res.json({
            type: coupon.type,
            value: coupon.value,
            code: coupon.code,
            maxdiscount: coupon.maxdiscount
        });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});
/* ================= INITIALIZE & START ================= */
async function initializeAdmin() {
    const adminEmail = "admin@clothify.com";
    await User.deleteMany({ email: adminEmail });
    await User.create({ firstName: "System", lastName: "Admin", email: adminEmail, password: "admin123", role: "admin" });
    console.log("✅ Admin RESET: admin@clothify.com / admin123");
}

let isConnected = false;

const connectDB = async () => {
    if (isConnected) return;
    const db = await mongoose.connect(MONGO_URI);
    isConnected = db.connections[0].readyState;
    console.log("✅ MongoDB Connected");
};

// run on every request (serverless style)
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

/* ================= CATEGORY ROUTES ================= */

// GET all categories
app.get("/api/categories", async (req, res) => {
    try {
        const categories = await Category.find().sort({ name: 1 });
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE category
app.post("/api/categories", authenticateToken, isAdmin, async (req, res) => {
    try {
        const category = new Category({ name: req.body.name });
        await category.save();
        res.status(201).json(category);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/* ================= MISSING ORDER DETAIL ROUTES ================= */

// 1. USER: Get single order details (Used by profile.html)
app.get("/api/orders/:id", authenticateToken, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Security Check: Ensure the user owns this order (unless they are admin)
        if (order.userId.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Unauthorized access to this order" });
        }

        res.json(order);
    } catch (err) {
        res.status(500).json({ message: "Server error fetching order details" });
    }
});

// 2. USER: Update Profile Details (Used by profile.html 'Save Changes')
app.get("/api/users/profile", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: "Error fetching profile" });
    }
});

app.put("/api/users/profile", authenticateToken, async (req, res) => {
    try {
        const { firstName, lastName } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { firstName, lastName },
            { new: true }
        ).select("-password");
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: "Update failed" });
    }
});

// DELETE an order by ID (Admin only)
app.delete("/api/orders/:id", authenticateToken, isAdmin, async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        res.json({ success: true, message: "Order deleted successfully" });
    } catch (err) {
        console.error("Delete Order Error:", err.message);
        res.status(500).json({ success: false, error: "Failed to delete order" });
    }
});

app.put('/api/orders/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) return res.status(400).json({ message: "Status is required" });

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        ).populate("userId", "firstName lastName email");

        if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
        res.json(updatedOrder);
    } catch (err) {
        res.status(500).json({ message: "Server error: " + err.message });
    }
});

app.get("/api/orders/:id", authenticateToken, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate("userId", "firstName lastName email");
        if (!order) return res.status(404).json({ message: "Order not found" });

        // Security: Admins can see all, Users only their own
        if (req.user.role !== 'admin' && order.userId._id.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        res.json(order);
    } catch (err) {
        res.status(500).json({ message: "Error fetching order" });
    }
});

// ================= RETURN / EXCHANGE REQUEST =================
app.post("/api/orders/request-action", authenticateToken, async (req, res) => {
    try {
        const { orderId, itemId, type, reason, comments } = req.body;

        // Validate input
        if (!orderId || !itemId || !type || !reason) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Security check (user owns order)
        if (order.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        // 🔥 Add request to order (you can customize this schema)
        if (!order.requests) order.requests = [];

        order.requests.push({
            itemId,
            type, // return / exchange
            reason,
            comments,
            status: "Pending",
            createdAt: new Date()
        });

        await order.save();

        res.json({
            success: true,
            message: `${type} request submitted successfully`
        });

    } catch (err) {
        console.error("Request Action Error:", err);
        res.status(500).json({ message: "Server error" });
    }
});


const crypto = require("crypto");

/* ================= FORGOT PASSWORD ROUTE ================= */
app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = crypto.randomBytes(32).toString("hex");

    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 mins

    await user.save();


const resetLink = `http://localhost:5000/reset-password.html?token=${token}`;
    // For now (DEV), return link
    res.json({ success: true, debugLink: resetLink });
});

    app.post("/api/payment/create-order", async (req, res) => {
  const options = {
    amount: req.body.amount * 100, // paise
    currency: "INR"
  };

  const order = await razorpay.orders.create(options);
  res.json(order);
});

app.post("/api/payment/verify", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", "GsLaryF3VtGUK4iah79881dJ")
    .update(body)
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false });
  }
});


app.post("/api/auth/reset-password", async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: "Token and password required" });
        }

        const user = await User.findOne({
            resetToken: token,
            resetTokenExpiry: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        // Update password (will auto hash via pre-save hook)
        user.password = password;

        // Clear token
        user.resetToken = undefined;
        user.resetTokenExpiry = undefined;

        await user.save();

        res.json({ success: true, message: "Password reset successful" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});    

module.exports = app;
