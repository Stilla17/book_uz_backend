const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    password: { type: String },
    phone: { type: String, unique: true, sparse: true },
    birthDate: { type: Date },
    birthdaySmsSentYear: {
      type: Number,
      default: null,
    },
    ordersCount: {
      type: Number,
      default: 0,
    },
    ordersAmount: {
      type: Number,
      default: 0,
    },
    lastOrderAt: { type: Date },
    role: {
      type: String,
      enum: ["USER", "ADMIN", "SUPERADMIN"],
      default: "USER",
    },
    avatar: { type: String, default: "" },
    bio: { type: String, default: "" },
    addresses: [
      {
        city: String,
        region: String,
        street: String,
        isDefault: { type: Boolean, default: false },
      },
    ],
    purchasedBooks: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        quantity: { type: Number, default: 1 },
        purchasedAt: { type: Date, default: Date.now },
        order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
      },
    ],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    isVerified: { type: Boolean, default: false },
    refreshToken: { type: String },
    telegramUsername: {
      type: String,
      default: "",
      trim: true,
      validate: {
        validator: (value) => !value || /^@[A-Za-z0-9_]{5,32}$/.test(value),
        message: "Telegram username noto'g'ri",
      },
    },
    telegramChatId: {
      type: String,
      default: null,
    },

    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      telegram: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
    },

    security: {
      twoFactorAuth: { type: Boolean, default: false },
      loginAlerts: { type: Boolean, default: true },
      deviceHistory: { type: Boolean, default: false },
    },

    preferences: {
      language: { type: String, default: "uz", enum: ["uz", "ru", "en"] },
      currency: { type: String, default: "UZS", enum: ["UZS", "USD", "RUB"] },
    },

    devices: [
      {
        name: String,
        type: { type: String, enum: ["mobile", "laptop", "tablet", "other"] },
        location: String,
        lastActive: { type: Date, default: Date.now },
        userAgent: String,
        ip: String,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", UserSchema);
