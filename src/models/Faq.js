const mongoose = require("mongoose");

const FaqSchema = new mongoose.Schema(
  {
    question: {
      uz: { type: String, required: true },
      ru: { type: String },
      en: { type: String },
    },
    answer: {
      uz: { type: String, required: true },
      ru: { type: String },
      en: { type: String },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

FaqSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model("Faq", FaqSchema);
