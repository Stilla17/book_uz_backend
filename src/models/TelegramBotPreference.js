const mongoose = require("mongoose");

const TelegramBotPreferenceSchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
    },
    language: {
      type: String,
      enum: ["uz", "ru"],
      default: "uz",
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "TelegramBotPreference",
  TelegramBotPreferenceSchema,
);
