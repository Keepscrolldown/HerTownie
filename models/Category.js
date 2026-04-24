const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  }
}, { timestamps: true });

// Updated hook: No 'next' needed for synchronous logic
categorySchema.pre('save', function() {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .split(' ')
      .join('-')
      .replace(/[^\w-]+/g, ''); 
  }
});

module.exports = mongoose.model("Category", categorySchema);