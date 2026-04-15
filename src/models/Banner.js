const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
  // Asosiy ma'lumotlar
  title: {
    uz: { type: String, required: true },
    ru: { type: String, required: true },
    en: { type: String, required: true }
  },
  subtitle: {
    uz: { type: String },
    ru: { type: String },
    en: { type: String }
  },
  description: {
    uz: { type: String },
    ru: { type: String },
    en: { type: String }
  },
  
  // Banner turi
  type: { 
    type: String, 
    enum: ['hero', 'author', 'quote', 'news'], 
    required: true,
    default: 'hero'
  },
  
  // Rasm
  imageUrl: { type: String, required: true },
  
  // Tugma
  buttonText: {
    uz: { type: String },
    ru: { type: String },
    en: { type: String }
  },
  buttonLink: { type: String },
  
  // Dizayn
  backgroundColor: { type: String },
  textColor: { type: String, default: '#ffffff' },
  badge: {
    uz: { type: String },
    ru: { type: String },
    en: { type: String }
  },
  
  // Tartib
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  
  // Author uchun qo'shimcha maydonlar
  author: {
    name: { type: String },
    nameUz: { type: String },
    nameRu: { type: String },
    nameEn: { type: String },
    shortBio: {
      uz: { type: String },
      ru: { type: String },
      en: { type: String }
    },
    birthYear: { type: String },
    deathYear: { type: String },
    country: { type: String },
    booksCount: { type: Number, default: 0 },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Author' }
  },
  
  // Tanlangan kitoblar (Author uchun)
  selectedBooks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  
  // Quote uchun qo'shimcha maydonlar
  quote: {
    text: {
      uz: { type: String },
      ru: { type: String },
      en: { type: String }
    },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Author' },
    authorName: { type: String },
    authorImage: { type: String }
  },
  
  // Statistika
  views: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 }
  
}, { timestamps: true });


BannerSchema.index({ type: 1, order: 1 });
BannerSchema.index({ isActive: 1 });

module.exports = mongoose.model('Banner', BannerSchema);