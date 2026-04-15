// backend/src/models/UserSubscription.js
const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'trial'],
    default: 'trial'
  },
  period: { type: String, enum: ['monthly', 'yearly'], required: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  autoRenew: { type: Boolean, default: true },
  paymentMethod: { type: String },
  paymentDetails: { type: Object },
  price: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userSubscriptionSchema.index({ user: 1, status: 1 });
userSubscriptionSchema.index({ endDate: 1 });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);