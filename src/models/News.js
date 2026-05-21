const mongoose = require("mongoose");

const localizedText = {
  uz: { type: String, required: true, trim: true },
  ru: { type: String, required: true, trim: true },
  en: { type: String, required: true, trim: true },
};

const optionalLocalizedText = {
  uz: { type: String, trim: true },
  ru: { type: String, trim: true },
  en: { type: String, trim: true },
};

const NewsSchema = new mongoose.Schema(
  {
    title: localizedText,
    slug: { type: String, required: true, unique: true, trim: true },
    excerpt: optionalLocalizedText,
    description: localizedText,
    image: { type: String, required: true },
    tags: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

NewsSchema.index({ slug: 1 });
NewsSchema.index({ isActive: 1, publishedAt: -1 });
NewsSchema.index({ isFeatured: 1, publishedAt: -1 });
NewsSchema.index({
  "title.uz": "text",
  "title.ru": "text",
  "title.en": "text",
});

module.exports = mongoose.model("News", NewsSchema);
