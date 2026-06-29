const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: Number,
      required: true,
      unique: true,
      sparse: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    guestName: { type: String },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        quantity: { type: Number, required: true },
        priceAtTime: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true },
    shippingAddress: {
      city: String,
      region: String,
      street: String,
      phone: String,
    },
    description: { type: String },
    couponCode: { type: String },
    discountAmount: { type: Number, default: 0 },
    deliveryType: {
      type: String,
      enum: ["PICKUP", "DELIVERY", "POST"],
      default: "DELIVERY",
    },
    postDeliveryType: {
      type: String,
      enum: ['POST_OFFICE', 'POST_TO_HOME'],
      required: false
    },
    paymentType: {
      type: String,
      enum: ["CASH", "CLICK", "UZUM", "PAYME", "XAZNA"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PENDING",
    },
    status: {
      type: String,
      enum: [
        "PENDING",
        "CONFIRMED",
        "PACKED",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
      ],
      default: "PENDING",
    },
    deliveryFee: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", OrderSchema);
