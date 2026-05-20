const User = require('../../models/User');
const bcrypt = require('bcrypt');
const apiResponse = require('../../utils/apiResponse');
const { getPaginationParams, buildPagination } = require('../../utils/pagination');
const { buildSearchRegex } = require('../../utils/searchRegex');

/**
 * 1. Barcha foydalanuvchilarni olish (Filtr va Pagination bilan)
 */

const getAllUsersAdmin = async (req, res, next) => {
  try {
    const { role, search } = req.query;
    const paginationParams = getPaginationParams(req.query);
    let filter = {};
    if (role) filter.role = role;

    if (search) {
      const searchRegex = buildSearchRegex(search);
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex }
      ];
    }

    const users = await User.find(filter)
      .select('-password -refreshToken')
      .sort('-createdAt')
      .skip(paginationParams.skip)
      .limit(paginationParams.limit);

    const total = await User.countDocuments(filter);

    apiResponse(res, 200, true, "Foydalanuvchilar ro'yxati", {
      users,
      pagination: buildPagination({ ...paginationParams, total })
    });
  } catch (error) { next(error); }
};

/**
 * 2. Foydalanuvchi ma'lumotlarini admin tomonidan tahrirlash
 * Ism, Email yoki Rolini (masalan USERdan ADMINga) o'zgartirish
 */

const updateUserAdmin = async (req, res, next) => {
  try {
    const { name, email, role, isVerified } = req.body;
    const updateData = { name, email, role, isVerified };

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).select('-password');

    if (!user) return apiResponse(res, 404, false, "Foydalanuvchi topilmadi");

    apiResponse(res, 200, true, "Foydalanuvchi ma'lumotlari yangilandi", user);
  } catch (error) { next(error); }
};

/**
 * 3. Foydalanuvchi parolini majburiy yangilash (Reset Password)
 * Agar user parolini yo'qotsa, admin unga yangi parol o'rnatib berishi uchun
 */

const resetUserPasswordAdmin = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return apiResponse(res, 400, false, "Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const user = await User.findByIdAndUpdate(req.params.id, {
      password: hashedPassword
    });

    if (!user) return apiResponse(res, 404, false, "Foydalanuvchi topilmadi");

    apiResponse(res, 200, true, "Foydalanuvchi paroli muvaffaqiyatli yangilandi");
  } catch (error) { next(error); }
};

/**
 * 4. Foydalanuvchini o'chirish yoki bloklash
 */

const deleteUserAdmin = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return apiResponse(res, 400, false, "O'zingizni o'chira olmaysiz!");
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return apiResponse(res, 404, false, "Foydalanuvchi topilmadi");

    apiResponse(res, 200, true, "Foydalanuvchi tizimdan o'chirildi");
  } catch (error) { next(error); }
};

/**
 * 5. Bitta foydalanuvchining barcha aktivligi (Orderlari, Reviewlari)
 */

const getUserFullDetailsAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return apiResponse(res, 404, false, "Foydalanuvchi topilmadi");

    const Order = require('../../models/Order');
    const orders = await Order.find({ user: user._id }).sort('-createdAt');

    apiResponse(res, 200, true, "Foydalanuvchi haqida to'liq ma'lumot", {
      user,
      orders
    });
  } catch (error) { next(error); }
};

module.exports = {
  getAllUsersAdmin,
  updateUserAdmin,
  resetUserPasswordAdmin,
  deleteUserAdmin,
  getUserFullDetailsAdmin
};
