const Coupon = require('../../models/Coupon');
const Cart = require('../../models/Cart');
const apiResponse = require('../../utils/apiResponse');

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

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return apiResponse(res, 404, false, "Savat topilmadi");

    if (cart.totalPrice < coupon.minOrderAmount) {
      return apiResponse(res, 400, false, `Minimal xarid summasi ${coupon.minOrderAmount} so'm bo'lishi kerak`);
    }

    const discountAmount = (cart.totalPrice * coupon.discountPercentage) / 100;
    cart.totalPrice = cart.totalPrice - discountAmount;
    
    await cart.save();

    apiResponse(res, 200, true, `Kupon qo'llandi: -${coupon.discountPercentage}%`, {
      finalPrice: cart.totalPrice,
      discountAmount
    });
  } catch (error) { next(error); }
};