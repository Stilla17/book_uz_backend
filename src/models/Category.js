const mongoose = require("mongoose");

const localizedStringSchema = new mongoose.Schema(
  {
    uz: { type: String, required: true },
    ru: { type: String, required: true },
    en: { type: String, required: true },
  },
  { _id: false },
);

const subgenreSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, trim: true },
    title: { type: localizedStringSchema, required: true },
    books: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);

const CategorySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    title: { type: localizedStringSchema, required: true },
    subgenres: { type: [subgenreSchema], default: [] },
    icon: { type: String, default: "" },
    image: { type: String, default: "" },
    description: {
      uz: { type: String },
      ru: { type: String },
      en: { type: String },
    },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false }, // Tanlangan kategoriya
  },
  { timestamps: true },
);

CategorySchema.pre("init", function syncLegacyFields(data) {
  if (!data.title && data.name) {
    data.title = data.name;
  }
});

CategorySchema.pre("validate", function syncFields() {
  if (!this.title && this.name) {
    this.title = this.name;
  }
});

CategorySchema.virtual("name").get(function getName() {
  return this.title;
});

CategorySchema.index({ slug: 1 });
CategorySchema.index({ order: 1 });
CategorySchema.index({ "title.uz": 1, "title.ru": 1, "title.en": 1 });
CategorySchema.index({ "subgenres.slug": 1 });

CategorySchema.set("toJSON", { virtuals: true });
CategorySchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Category", CategorySchema);
