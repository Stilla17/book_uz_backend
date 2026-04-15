const Review = require('../../models/Review');
const Product = require('../../models/Product');
const apiResponse = require('../../utils/apiResponse');

/**
 * 1. Sharhlarni filtrlash (Hammasi, Faqat tasdiqlanmagan, Faqat yomon reyting)
 */

const getAllReviewsAdmin = async (req, res, next) => {
  try {
    const { status, rating, page = 1, limit = 10 } = req.query;
    let filter = {};

    if (status === 'pending') filter.isApproved = false;
    if (status === 'approved') filter.isApproved = true;
    if (rating) filter.rating = Number(rating);

    const skip = (page - 1) * limit;
    const reviews = await Review.find(filter)
      .populate('user', 'name email avatar')
      .populate('product', 'title images')
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit));

    const total = await Review.countDocuments(filter);

    apiResponse(res, 200, true, "Sharhlar ro'yxati", {
      reviews,
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (error) { next(error); }
};

/**
 * 2. Sharhni tasdiqlash yoki rad etish (Mantiqiy takomillashtirilgan)
 */

const moderateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approve } = req.body;

    const review = await Review.findById(id);
    if (!review) return apiResponse(res, 404, false, "Sharh topilmadi");

    if (approve) {
      review.isApproved = true;
      await review.save();
      await updateProductRating(review.product);
      
      apiResponse(res, 200, true, "Sharh tasdiqlandi va saytda ko'rinadigan bo'ldi");
    } else {
      const productId = review.product;
      await Review.findByIdAndDelete(id);
      
      await updateProductRating(productId);
      
      apiResponse(res, 200, true, "Sharh spam/nomaqbul deb topildi va o'chirildi");
    }
  } catch (error) { next(error); }
};

/**
 * 3. Sharhga Admin javobi (Admin Reply)
 * Do'kon xodimi mijozning sharhiga minnatdorchilik bildirishi yoki e'tiroziga javob berishi uchun
 */

const replyToReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { replyText } = req.body;

    const review = await Review.findByIdAndUpdate(
      id,
      { adminReply: replyText, repliedAt: Date.now() },
      { new: true }
    );

    if (!review) return apiResponse(res, 404, false, "Sharh topilmadi");

    apiResponse(res, 200, true, "Sharhga javob yozildi", review);
  } catch (error) { next(error); }
};

/**
 * 4. Review Statistikasi (Dashboard uchun)
 */

const getReviewStats = async (req, res, next) => {
  try {
    const stats = await Review.aggregate([
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": -1 } }
    ]);

    const pendingCount = await Review.countDocuments({ isApproved: false });

    apiResponse(res, 200, true, "Sharhlar statistikasi", {
      ratingDistribution: stats,
      pendingCount
    });
  } catch (error) { next(error); }
};

/**
 * Yordamchi funksiya: Mahsulot reytingini yangilash
 */

async function updateProductRating(productId) {
  const reviews = await Review.find({ product: productId, isApproved: true });
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
  getAllReviewsAdmin, 
  moderateReview, 
  replyToReview, 
  getReviewStats 
};