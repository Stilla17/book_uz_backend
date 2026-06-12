const mongoose = require("mongoose");

const amoContactSchema = new mongoose.Schema(
  {
    amoId: {
      type: Number,
      unique: true,
      sparse: true,
      index: true,
    },
    moyskladId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    name: String,
    firstName: String,
    lastName: String,
    responsibleUserId: Number,
    phones: [String],
    normalizedPhones: {
      type: [String],
      index: true,
    },
    emails: [String],
    normalizedEmails: {
      type: [String],
      index: true,
    },
    birthDate: Date,
    moyskladTags: [String],
    lastSaleAt: Date,
    salesCount: {
      type: Number,
      default: 0,
    },
    averageCheck: {
      type: Number,
      default: 0,
    },
    salesAmount: {
      type: Number,
      default: 0,
    },
    sources: {
      amocrm: {
        type: Boolean,
        default: false,
      },
      moysklad: {
        type: Boolean,
        default: false,
      },
    },
    tags: [
      {
        id: Number,
        name: String,
      },
    ],
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    amoCreatedAt: Date,
    amoUpdatedAt: Date,
    moyskladCreatedAt: Date,
    moyskladUpdatedAt: Date,
    moyskladData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    syncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("AmoContact", amoContactSchema);
