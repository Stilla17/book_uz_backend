const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  otp: { type: String, required: true },
  type: { type: String, enum: ['EMAIL', 'SMS', "TELEGRAM"], required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 },
  expiresAt: { 
    type: Date, 
    default: () => new Date(Date.now() + 5 * 60 * 1000), 
    index: { expires: '5m' } 
  }
}, { timestamps: true });

module.exports = mongoose.model('OTP', otpSchema);