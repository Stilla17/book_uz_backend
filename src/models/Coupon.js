const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Kupon kodi bo\'lishi shart'],
    unique: true,
    uppercase: true,
    trim: true
  },
  discountPercentage: {
    type: Number,
    required: [true, 'Chegirma foizi bo\'lishi shart'],
    min: 1,
    max: 100
  },
  expiryDate: {
    type: Date,
    required: [true, 'Amal qilish muddati bo\'lishi shart']
  },
  minOrderAmount: {
    type: Number,
    default: 0 // Kupon ishlashi uchun minimal xarid summasi
  },
  usageLimit: {
    type: Number,
    default: 100 // Jami necha marta ishlatilishi mumkinligi
  },
  usedCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });


CouponSchema.virtual('isExpired').get(function() {
  return Date.now() > this.expiryDate;
});

module.exports = mongoose.model('Coupon', CouponSchema);