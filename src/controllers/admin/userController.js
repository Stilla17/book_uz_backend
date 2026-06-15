const User = require('../../models/User');
const AmoContact = require('../../models/AmoContact');
const bcrypt = require('bcrypt');
const apiResponse = require('../../utils/apiResponse');
const { getPaginationParams, buildPagination } = require('../../utils/pagination');
const { buildSearchRegex } = require('../../utils/searchRegex');

/**
 * 1. Barcha foydalanuvchilar va AmoCRM kontaktlarini olish
 */

const getAllUsersAdmin = async (req, res, next) => {
  try {
    const { role, search, all } = req.query;
    const returnAll = String(all).toLowerCase() === 'true';
    const paginationParams = getPaginationParams(req.query);
    const userFilter = {};
    const amoContactFilter = {};

    if (role) userFilter.role = role.toUpperCase();

    if (search) {
      const searchRegex = buildSearchRegex(search);
      userFilter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
      amoContactFilter.$or = [
        { name: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        { phones: searchRegex },
        { emails: searchRegex }
      ];
    }

    const userQuery = User.find(userFilter)
      .select('-password -refreshToken')
      .sort('-createdAt');
    const amoContactQuery = AmoContact.find(amoContactFilter)
      .sort('-createdAt');

    if (!returnAll) {
      userQuery
        .skip(paginationParams.skip)
        .limit(paginationParams.limit);
      amoContactQuery
        .skip(paginationParams.skip)
        .limit(paginationParams.limit);
    }

    const [users, usersTotal, amoContacts, amoContactsTotal] = await Promise.all([
      userQuery,
      User.countDocuments(userFilter),
      amoContactQuery,
      AmoContact.countDocuments(amoContactFilter)
    ]);

    const total = usersTotal + amoContactsTotal;
    const usersPaginationParams = returnAll
      ? { page: 1, limit: usersTotal || 1 }
      : paginationParams;
    const amoContactsPaginationParams = returnAll
      ? { page: 1, limit: amoContactsTotal || 1 }
      : paginationParams;
    const combinedPaginationParams = returnAll
      ? { page: 1, limit: total || 1 }
      : {
          page: paginationParams.page,
          limit: paginationParams.limit * 2
        };

    apiResponse(res, 200, true, "Foydalanuvchilar ro'yxati", {
      users,
      amoContacts,
      items: [...users, ...amoContacts],
      pagination: buildPagination({
        ...combinedPaginationParams,
        total
      }),
      usersPagination: buildPagination({
        ...usersPaginationParams,
        total: usersTotal
      }),
      amoContactsPagination: buildPagination({
        ...amoContactsPaginationParams,
        total: amoContactsTotal
      }),
      totals: {
        users: usersTotal,
        amoContacts: amoContactsTotal,
        all: total
      }
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
