const mongoose = require('mongoose');

const AudioBookSchema = new mongoose.Schema({
  // Asosiy ma'lumotlar
  title: {
    uz: { type: String, required: true },
    ru: { type: String, required: true },
    en: { type: String, required: true }
  },
  slug: { type: String, required: true, unique: true },
  
  // Muallif va diktor
  author: {
    uz: { type: String, required: true },
    ru: { type: String, required: true },
    en: { type: String, required: true }
  },
  narrator: {
    uz: { type: String, required: true },
    ru: { type: String, required: true },
    en: { type: String, required: true }
  },
  
  // Tavsif
  description: {
    uz: { type: String },
    ru: { type: String },
    en: { type: String }
  },
  
  // Audio va rasm
  coverImage: { type: String, required: true },
  audioUrl: { type: String },
  audioFileId: { type: String },
  
  // Metama'lumotlar
  duration: { type: String, required: true },
  durationSeconds: { type: Number },
  
  // Kategoriya
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  tags: [{ type: String }],
  
  // Reyting
  rating: { type: Number, default: 0 },
  reviewsCount: { type: Number, default: 0 },
  
  // Statistika
  listens: { type: Number, default: 0 },
  downloads: { type: Number, default: 0 },
  
  // Status
  isNew: { type: Boolean, default: false },
  isHit: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  
  order: { type: Number, default: 0 }
  
}, { timestamps: true });


AudioBookSchema.index({ category: 1 });
AudioBookSchema.index({ isActive: 1, order: 1 });
AudioBookSchema.index({ isHit: 1 });
AudioBookSchema.index({ isNew: 1 });


module.exports = mongoose.model('AudioBook', AudioBookSchema);