const mongoose = require('mongoose');

const DeliverySchema = new mongoose.Schema({
  regionName: {
    uz: { type: String, required: true },
    ru: { type: String, required: true }
  },
  price: { 
    type: Number, 
    required: true, 
    default: 0 
  },
  estimatedDays: { 
    type: String, 
    default: "2-3 kun" 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

module.exports = mongoose.model('Delivery', DeliverySchema);