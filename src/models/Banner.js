const mongoose = require("mongoose");

const BannerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true },
    link: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

BannerSchema.index({ order: 1 });

module.exports = mongoose.model("Banner", BannerSchema);
