const mongoose = require("mongoose");

const TopSalesProductSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    barcode: { type: String, trim: true },
    soldQuantity: { type: Number, default: 0 },
  },
  { _id: false },
);

const MoyskladTopSalesSchema = new mongoose.Schema(
  {
    period: { type: String, enum: ["week", "month"], required: true, unique: true },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    products: { type: [TopSalesProductSchema], default: [] },
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);


module.exports = mongoose.model("MoyskladTopSales", MoyskladTopSalesSchema);
