const Coupon = require('../../models/Coupon');
const apiResponse = require('../../utils/apiResponse');

/**
 * 1. Yangi kupon yaratish
 */

exports.createCoupon = async (req, res, next) => {
  try {
    const {
      code,
      type,
      value,
      discountPercentage,
      startDate,
      endDate,
      expiryDate,
      minOrderAmount,
      usageLimit,
      applicableProducts = [],
      applicablePublishers = [],
      isActive,
    } = req.body;

    const coupon = await Coupon.create({
      code,
      type,
      value,
      discountPercentage,
      startDate,
      endDate: endDate || expiryDate,
      minOrderAmount,
      usageLimit,
      applicableProducts,
      applicablePublishers,
      isActive,
    });

    apiResponse(res, 201, true, "Kupon muvaffaqiyatli yaratildi", coupon);
  } catch (error) { next(error); }
};

/**
 * 2. Barcha kuponlarni ko'rish
 */

exports.getAllCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find()
      .populate('applicableProducts', 'title slug price images')
      .populate('applicablePublishers', 'name slug image')
      .sort('-createdAt');

    apiResponse(res, 200, true, "Barcha kuponlar ro'yxati", coupons);
  } catch (error) { next(error); }
};

/**
 * 3. Kuponni yangilash
 */

exports.updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!coupon) return apiResponse(res, 404, false, "Kupon topilmadi");

    apiResponse(res, 200, true, "Kupon muvaffaqiyatli yangilandi", coupon);
  } catch (error) { next(error); }
};

/**
 * 4. Kuponni o'chirish
 */

exports.deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return apiResponse(res, 404, false, "Kupon topilmadi");
    apiResponse(res, 200, true, "Kupon o'chirildi");
  } catch (error) { next(error); }
};
