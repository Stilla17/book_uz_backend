const mongoose = require('mongoose');

const PromoCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  type: { type: String, enum: ['PERCENT', 'FIXED'], default: 'PERCENT' },
  value: { type: Number, required: true }, 
  minOrderAmount: { type: Number, default: 0 },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  usageLimit: { type: Number, default: 100 },
  usedCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('PromoCode', PromoCodeSchema);