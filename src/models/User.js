const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['USER', 'ADMIN', 'SUPERADMIN'], default: 'USER' },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '' },
  phone: { type: String, default: '' },
  addresses: [{
    city: String,
    region: String,
    street: String,
    isDefault: { type: Boolean, default: false }
  }],
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  isVerified: { type: Boolean, default: false },
  refreshToken: { type: String },
  telegramChatId: {
    type: String,
    default: null
  },

  notifications: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    telegram: { type: Boolean, default: true },
    push: { type: Boolean, default: true }
  },

  security: {
    twoFactorAuth: { type: Boolean, default: false },
    loginAlerts: { type: Boolean, default: true },
    deviceHistory: { type: Boolean, default: false }
  },

  preferences: {
    language: { type: String, default: 'uz', enum: ['uz', 'ru', 'en'] },
    currency: { type: String, default: 'UZS', enum: ['UZS', 'USD', 'RUB'] }
  },

  devices: [{
    name: String,
    type: { type: String, enum: ['mobile', 'laptop', 'tablet', 'other'] },
    location: String,
    lastActive: { type: Date, default: Date.now },
    userAgent: String,
    ip: String
  }]


}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);