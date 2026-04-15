const Coupon = require('../../models/Coupon');
const apiResponse = require('../../utils/apiResponse');

/**
 * 1. Yangi kupon yaratish
 */

exports.createCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.create(req.body);
    apiResponse(res, 201, true, "Kupon muvaffaqiyatli yaratildi", coupon);
  } catch (error) { next(error); }
};

/**
 * 2. Barcha kuponlarni ko'rish
 */

exports.getAllCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort('-createdAt');
    apiResponse(res, 200, true, "Barcha kuponlar ro'yxati", coupons);
  } catch (error) { next(error); }
};

/**
 * 3. Kuponni o'chirish
 */

exports.deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return apiResponse(res, 404, false, "Kupon topilmadi");
    apiResponse(res, 200, true, "Kupon o'chirildi");
  } catch (error) { next(error); }
};