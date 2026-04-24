const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    type: { type: String, enum: ["percent", "fixed"], required: true },
    value: { type: Number, required: true }, // e.g., 10 for 10% or 200 for ₹200
    minOrder: { type: Number, default: 0 },
    maxdiscount: {type: Number, default: 0},
    expiryDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model("Coupon", couponSchema);