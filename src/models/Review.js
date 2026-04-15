const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: [true, 'Sharh qaysi mahsulotga tegishli ekanligi ko\'rsatilmadi'] 
  },
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Sharh muallifi ko\'rsatilmadi'] 
  },
  rating: { 
    type: Number, 
    min: 1, 
    max: 5, 
    required: [true, 'Reyting (1-5 gacha) bo\'lishi shart'] 
  },
  comment: { 
    type: String, 
    required: [true, 'Sharh matni bo\'lishi shart'],
    trim: true
  },
  images: [{ 
    type: String // Sharhga biriktirilgan rasmlar manzili
  }],
  isPurchased: { 
    type: Boolean, 
    default: false 
  },
  isApproved: { 
    type: Boolean, 
    default: true // Xohlasangiz false qilib, admin tasdig'idan keyin ko'rsatishingiz mumkin
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Bitta user bitta mahsulotga faqat bitta sharh qoldirishi uchun (Database level index)
ReviewSchema.index({ product: 1, user: 1 }, { unique: true });

/**
 * Statik metod: Mahsulotning o'rtacha reytingini hisoblash
 */

ReviewSchema.statics.calculateAverageRating = async function(productId) {
  const stats = await this.aggregate([
    {
      $match: { product: productId, isApproved: true }
    },
    {
      $group: {
        _id: '$product',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' }
      }
    }
  ]);

  if (stats.length > 0) {
    await mongoose.model('Product').findByIdAndUpdate(productId, {
      ratingCount: stats[0].nRating,
      ratingAvg: stats[0].avgRating.toFixed(1)
    });
  } else {
    await mongoose.model('Product').findByIdAndUpdate(productId, {
      ratingCount: 0,
      ratingAvg: 0
    });
  }
};

/**
 * Middleware: Sharh saqlangandan keyin reytingni yangilash
 */

ReviewSchema.post('save', function() {
  this.constructor.calculateAverageRating(this.product);
});

/**
 * Middleware: Sharh o'chirilishidan oldin/keyin reytingni yangilash
 */

ReviewSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    await doc.constructor.calculateAverageRating(doc.product);
  }
});

module.exports = mongoose.model('Review', ReviewSchema);