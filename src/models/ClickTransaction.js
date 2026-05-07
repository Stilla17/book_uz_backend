const mongoose = require("mongoose");

const clickTransactionSchema = new mongoose.Schema(
  {
    click_trans_id: { type: String, required: true, unique: true },
    click_paydoc_id: { type: String },
    merchant_trans_id: { type: String, required: true },
    merchant_prepare_id: { type: String, required: true },
    amount: { type: Number, required: true },
    service_id: { type: String },
    status: {
      type: String,
      enum: ["prepared", "paid", "cancelled"],
      default: "prepared",
    },
    paid_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);


module.exports = mongoose.model("ClickTransaction", clickTransactionSchema);
