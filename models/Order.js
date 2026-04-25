const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true
            },
            name: {
                type: String,
                required: true
            },
            // Updated from String to [String] to accept the array in your error message
            image: [String], 
            size: String,
            quantity: {
                type: Number,
                required: true
            },
            price: {
                type: Number,
                required: true
            }
        }
    ],
    requests: [
        {
            itemId: String, 
            type: {
                type: String,
                enum: ["return", "exchange"]
            },
            reason: String,
            comments: String,
            status: {
                type: String,
                enum: ["Pending", "Approved", "Rejected"],
                default: "Pending"
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    total: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ["card", "cod", "upi", "razorpay"]
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed"],
        default: "pending"
    },
    paymentDetails: {
        razorpay_order_id: String,
        razorpay_payment_id: String,
        razorpay_signature: String
    },
    shippingDetails: {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true },
        address: { type: String, required: true },
        landmark: String,
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true }
    },
    status: {
        type: String,
        enum: [
            "Processing",
            "Shipped",
            "Out for Delivery",
            "Delivered",
            "Cancelled",
            "Returned"
        ],
        default: "Processing"
    }
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
