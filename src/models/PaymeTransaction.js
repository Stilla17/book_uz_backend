const mongoose = require("mongoose");

const PaymeTransactionSchema = new mongoose.Schema(
  {
    paymeId: { type: String, required: true, unique: true },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    amount: { type: Number, required: true },
    state: { type: Number, default: 1 },
    createTime: { type: Number, default: 0 },
    performTime: { type: Number, default: 0 },
    cancelTime: { type: Number, default: 0 },
    reason: { type: Number, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PaymeTransaction", PaymeTransactionSchema);
