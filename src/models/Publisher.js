const mongoose = require("mongoose");

const PublishersSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    image: { type: String },
    description: { type: String },

    books: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }], default: [] },
  },
  { timestamps: true },
);

PublishersSchema.index({ slug: 1 });
PublishersSchema.index({ name: 1 });

module.exports = mongoose.model("Publishers", PublishersSchema);
