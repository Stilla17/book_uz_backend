// backend/src/models/Subscription.js
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  name: {
    uz: { type: String, required: true },
    ru: { type: String, required: true },
    en: { type: String, required: true }
  },
  description: {
    uz: String,
    ru: String,
    en: String
  },
  price: {
    monthly: { type: Number, required: true },
    yearly: { type: Number, required: true }
  },
  features: [{
    uz: String,
    ru: String,
    en: String
  }],
  limits: {
    books: { type: Number, default: -1 },
    discount: { type: Number, default: 0 }
  },
  trialDays: { type: Number, default: 0 },
  isPopular: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  icon: { type: String },
  color: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
