const mongoose = require("mongoose");

const CashbackQrSessionSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    telegramId: {
      type: String,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "USED", "EXPIRED"],
      default: "ACTIVE",
      required: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// expiresAt vaqti o'tgach MongoDB hujjatni avtomatik o'chiradi.
CashbackQrSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("CashbackQrSession", CashbackQrSessionSchema);
