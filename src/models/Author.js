const mongoose = require('mongoose');

const AuthorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  image: { type: String },
  bio: {
    uz: String,
    ru: String,
    en: String
  },
  birthDate: { type: Date },
  deathDate: { type: Date },
  books: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], default: [] }
}, { timestamps: true });

AuthorSchema.index({ slug: 1 });
AuthorSchema.index({ name: 1 });

module.exports = mongoose.model('Author', AuthorSchema);
