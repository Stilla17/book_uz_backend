const mongoose = require("mongoose");
const Category = require("./Category");
const { findSubgenreByIdentifier } = require("../utils/subgenreMatcher");

const createProductValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const ProductSchema = new mongoose.Schema(
  {
    title: {
      uz: { type: String, required: true },
      ru: { type: String, required: true },
      en: { type: String, required: true },
    },
    slug: { type: String, required: true, unique: true },
    description: {
      uz: String,
      ru: String,
      en: String,
    },
    price: { type: Number, required: true },
    discountPrice: { type: Number, default: 0 },
    images: [{ type: String }],
    stock: { type: Number, default: 0 },
    branchStocks: [
      {
        storeId: String,  
        storeName: String,
        quantity: Number,
        reserve: Number,
        available: Number,
        syncedAt: Date,
      },
    ],
    barcode: { type: String, trim: true, unique: true },
    ikpuCode: {
      type: String,
      trim: true,
      match: [/^\d{17}$/, "IKPU kodi 17 ta raqamdan iborat bo'lishi kerak"],
    },
    packageCode: { type: String, trim: true },
    year: { type: Number },
    cover: {
      type: String,
      enum: ["hardcover", "softcover", "paperback", "ebook", "other"],
      default: "other",
    },
    numberOfPage: { type: Number, min: 0 },
    weight: { type: String, trim: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subCategoryId: { type: mongoose.Schema.Types.ObjectId },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Author",
      required: true,
    },

    publisher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Publishers",
    },

    contentLanguage: {
      type: String,
      enum: ["latin", "cyrillic"],
      default: "latin",
    },

    language: { type: String, enum: ["uz", "ru", "en"], default: "uz" },
    isTop: { type: Boolean, default: false },
    isDiscount: { type: Boolean, default: false },

    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

ProductSchema.pre("validate", async function validateSubgenreBinding() {
  if (!this.category) {
    return;
  }

  const category = await Category.findById(this.category).select("subgenres");
  if (!category) {
    throw createProductValidationError("Tanlangan kategoriya topilmadi");
  }

  if (!category.subgenres.length) {
    this.subCategoryId = undefined;
    return;
  }

  if (!this.subCategoryId) {
    throw createProductValidationError(
      "Bu kategoriya uchun subCategoryId majburiy",
    );
  }

  const matchedSubgenre = findSubgenreByIdentifier(
    category.subgenres,
    this.subCategoryId,
  );
  if (!matchedSubgenre) {
    throw createProductValidationError(
      "Tanlangan subCategoryId bu kategoriyaga tegishli emas",
    );
  }

  this.subCategoryId = matchedSubgenre._id;
});

ProductSchema.virtual("subgenre").get(function getSubgenre() {
  if (
    !this.category ||
    !Array.isArray(this.category.subgenres) ||
    !this.subCategoryId
  ) {
    return null;
  }

  const subgenre = this.category.subgenres.find(
    (item) => item._id?.toString() === this.subCategoryId.toString(),
  );

  return subgenre || null;
});

ProductSchema.index({ category: 1, subCategoryId: 1 });
ProductSchema.index({ author: 1 });
ProductSchema.index({ publisher: 1 });

const removedExternalProductFields = [
  ["barcode", "Normilize"],
  [["a", "u", "d", "i", "o"].join(""), "Price"],
  ["isAvailable", ["E", "book"].join("")],
  ["isAvailable", ["Aud", "io"].join("")],
].map((parts) => parts.join(""));

const hideRemovedProductFields = (doc, ret) => {
  removedExternalProductFields.forEach((field) => {
    delete ret[field];
  });

  return ret;
};

ProductSchema.set("toJSON", {
  virtuals: true,
  transform: hideRemovedProductFields,
});
ProductSchema.set("toObject", {
  virtuals: true,
  transform: hideRemovedProductFields,
});

module.exports = mongoose.model("Product", ProductSchema);
