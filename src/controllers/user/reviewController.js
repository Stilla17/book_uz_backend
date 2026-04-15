const Review = require('../../models/Review');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const apiResponse = require('../../utils/apiResponse');

/**
 * 1. Sharh qo'shish (Rasmlar va Dublikat tekshiruvi bilan)
 */
const addReview = async (req, res, next) => {
  try {
    const { productId, rating, comment } = req.body;

    const alreadyReviewed = await Review.findOne({
      user: req.user._id,
      product: productId
    });

    if (alreadyReviewed) {
      return apiResponse(res, 400, false, "Siz ushbu kitobga allaqachon sharh qoldirgansiz");
    }

    const hasBought = await Order.findOne({
      user: req.user._id,
      "items.product": productId,
      status: 'DELIVERED'
    });

    if (!hasBought) {
      return apiResponse(res, 403, false, "Sharh qoldirish uchun kitobni qabul qilib olgan bo'lishingiz kerak");
    }

    const images = req.files ? req.files.map(file => file.path) : [];

    const review = await Review.create({
      product: productId,
      user: req.user._id,
      rating,
      comment,
      images, 
      isPurchased: true,
      isApproved: true 
    });

    await updateProductRating(productId);

    apiResponse(res, 201, true, "Sharhingiz muvaffaqiyatli qo'shildi", review);
  } catch (error) { next(error); }
};

/**
 * 2. O'z sharhini tahrirlash
 */

const updateMyReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { rating, comment },
      { new: true }
    );

    if (!review) return apiResponse(res, 404, false, "Sharh topilmadi");

    await updateProductRating(review.product);
    apiResponse(res, 200, true, "Sharh tahrirlandi", review);
  } catch (error) { next(error); }
};

/**
 * 3. O'z sharhini o'chirish
 */

const deleteMyReview = async (req, res, next) => {
  try {
    const review = await Review.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    
    if (!review) return apiResponse(res, 404, false, "Sharh topilmadi");

    await updateProductRating(review.product);
    apiResponse(res, 200, true, "Sharh o'chirildi");
  } catch (error) { next(error); }
};

/**
 * Yordamchi funksiya: Reytingni yangilash
 */

async function updateProductRating(productId) {
  const reviews = await Review.find({ product: productId });
  const count = reviews.length;
  const avg = count > 0 
    ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / count).toFixed(1) 
    : 0;

  await Product.findByIdAndUpdate(productId, {
    ratingAvg: avg,
    ratingCount: count
  });
}

module.exports = { 
  addReview, 
  updateMyReview, 
  deleteMyReview 
};