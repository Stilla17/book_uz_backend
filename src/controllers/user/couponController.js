const Coupon = require('../../models/Coupon');
const Cart = require('../../models/Cart');
const apiResponse = require('../../utils/apiResponse');
const { calculateCouponDiscount, getCouponValue } = require('../../utils/couponDiscount');

/**
 * Faol kuponlar ro'yxati
 */

exports.getActiveCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find({ isActive: true }).sort("-createdAt");

    apiResponse(res, 200, true, "Faol kuponlar ro'yxati", coupons);
  } catch (error) { next(error); }
};

/**
 * Kuponni savatga qo'llash (Apply Coupon)
 */

exports.applyCoupon = async (req, res, next) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

    if (!coupon) {
      return apiResponse(res, 404, false, "Kupon noto'g'ri yoki muddati tugagan");
    }

    if (Date.now() > coupon.expiryDate) {
      return apiResponse(res, 400, false, "Kuponning amal qilish muddati tugagan");
    }

    if (coupon.usageLimit > 1 && coupon.usedCount >= coupon.usageLimit) {
      return apiResponse(res, 400, false, "Kupon ishlatish limiti tugagan");
    }

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart) return apiResponse(res, 404, false, "Savat topilmadi");

    if (cart.totalPrice < coupon.minOrderAmount) {
      return apiResponse(res, 400, false, `Minimal xarid summasi ${coupon.minOrderAmount} so'm bo'lishi kerak`);
    }

    const { eligibleSubtotal, discountAmount } = calculateCouponDiscount(coupon, cart.items);

    if (eligibleSubtotal <= 0) {
      return apiResponse(res, 400, false, "Bu kupon savatdagi kitoblarga tegishli emas");
    }

    const finalPrice = cart.totalPrice - discountAmount;
    const couponValue = getCouponValue(coupon);
    const discountLabel = coupon.type === 'FIXED'
      ? `${couponValue} so'm`
      : `${couponValue}%`;

    apiResponse(res, 200, true, `Kupon qo'llandi: -${discountLabel}`, {
      finalPrice,
      eligibleSubtotal,
      discountAmount
    });
  } catch (error) { next(error); }
};
