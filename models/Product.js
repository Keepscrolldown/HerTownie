const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    price: {
        type: Number,
        required: true,
        min: 0
    },

    images: {
        type: [String]
    },

    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },

    description: {
        type: String,
        default: ""
    },

    stock: {
        type: Number,
        default: 0,
        min: 0
    },

    sizes: {
        type: [String],
        default: []
    },

    featured: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);
