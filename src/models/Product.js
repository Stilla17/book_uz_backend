const mongoose = require("mongoose");
const Category = require("./Category");

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
    throw new Error("Tanlangan kategoriya topilmadi");
  }

  if (!category.subgenres.length) {
    this.subCategoryId = undefined;
    return;
  }

  if (!this.subCategoryId) {
    throw new Error("Bu kategoriya uchun subCategoryId majburiy");
  }

  const matchedSubgenre = category.subgenres.id(this.subCategoryId);
  if (!matchedSubgenre) {
    throw new Error("Tanlangan subCategoryId bu kategoriyaga tegishli emas");
  }
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

ProductSchema.set("toJSON", { virtuals: true });
ProductSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Product", ProductSchema);
