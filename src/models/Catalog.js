const mongoose = require("mongoose");

const catalogSchema = new mongoose.Schema(
  {
    price: {
      type: Number,
      required: [true, "Narx Majburiy"],
      min: [0, "Narx manfiy bo'lishi mumkin emas"],
    },

    wholesalePrice: {
      type: Number,
      min: [0, "Ulgurji narx manfiy bo'lishi mumkin emas"],
    },

    moyskladExternalCode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      set: (value) => value?.toString().trim() || undefined,
    },

    moyskladId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    
    moyskladName: {
      type: String,
      trim: true,
    },

    priceSyncedAt: Date,

    priceSyncStatus: {
      type: String,
      enum: ["pending", "synced", "error"],
      default: "pending",
    },

    priceSyncError: {
      type: String,
      trim: true,
    },

    image: {
      type: String,
      required: [true, "Rasm majburiy"],
      trim: true,
    },

    imageKey: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: [true, "Kategoriya majburiy"],
      enum: {
        values: ["badiiy", "nobadiiy", "trend", "bolalar-adabiyoti"],
        message: "Noto'g'ri kategoriya",
      },
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

catalogSchema.index({
  isActive: 1,
  category: 1,
  createdAt: -1,
});
module.exports = mongoose.model("Catalog", catalogSchema);
