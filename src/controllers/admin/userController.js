const User = require("../../models/User");
const AmoContact = require("../../models/AmoContact");
const Product = require("../../models/Product");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const apiResponse = require("../../utils/apiResponse");
const {
  getPaginationParams,
  buildPagination,
} = require("../../utils/pagination");
const { buildSearchRegex } = require("../../utils/searchRegex");
const { isValidEmail, isValidPhone } = require("../../utils/validator");
const { formatUzPhone, normalizePhone } = require("../../utils/phone");
const generateTempPassword = require("../../utils/passwordGenerator");

const normalizePurchasedBooks = async (source = []) => {
  const items = Array.isArray(source) ? source : [];
  const normalizedItems = items
    .map((item) => {
      const product =
        item.product || item.productId || item._id || item.id || item;
      const quantity = Number(item.quantity || 1);

      return {
        product,
        quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
      };
    })
    .filter((item) => mongoose.Types.ObjectId.isValid(item.product));

  if (!normalizedItems.length) return [];

  const productIds = [
    ...new Set(normalizedItems.map((item) => item.product.toString())),
  ];
  const existingProductIds = await Product.find({
    _id: { $in: productIds },
  }).distinct("_id");
  const existingSet = new Set(existingProductIds.map((id) => id.toString()));

  return normalizedItems
    .filter((item) => existingSet.has(item.product.toString()))
    .map((item) => ({
      product: item.product,
      quantity: item.quantity,
    }));
};

const normalizeAdminUserRole = (role) => {
  const normalizedRole = role?.toString().trim().toUpperCase() || "USER";
  const roleAliases = {
    CLIENT: "USER",
    CUSTOMER: "USER",
    CLIENT_USER: "USER",
    CUSTOMER_USER: "USER",
    USER_CUSTOMER: "USER",
    MIJOZ: "USER",
    FOYDALANUVCHI: "USER",
  };

  return roleAliases[normalizedRole] || normalizedRole;
};

const buildPhoneDuplicateChecks = (phone) => {
  const formattedPhone = formatUzPhone(phone);
  if (!isValidPhone(formattedPhone)) {
    return { formattedPhone: "", duplicateChecks: [] };
  }

  const phoneDigits = normalizePhone(formattedPhone);
  const localPhone = phoneDigits.startsWith("998")
    ? phoneDigits.slice(3)
    : phoneDigits;
  const phoneVariants = [
    formattedPhone,
    phoneDigits,
    localPhone,
    `+${phoneDigits}`,
    `+998${localPhone}`,
  ].filter(Boolean);

  return {
    formattedPhone,
    duplicateChecks: [{ phone: { $in: phoneVariants } }],
  };
};

const normalizeTelegramUsername = (telegramUsername) => {
  const value = telegramUsername?.toString().trim();
  if (!value) return "";

  const normalizedUsername = value.startsWith("@") ? value : `@${value}`;
  return /^@[A-Za-z0-9_]{5,32}$/.test(normalizedUsername)
    ? normalizedUsername
    : "";
};

/**
 * 1. Barcha foydalanuvchilar va AmoCRM kontaktlarini olish
 */

const getAllUsersAdmin = async (req, res, next) => {
  try {
    const { role, search, all } = req.query;
    const returnAll = String(all).toLowerCase() === "true";
    const paginationParams = getPaginationParams(req.query);
    const userFilter = {};
    const amoContactFilter = { normalizedPhones: /^\d{12}$/ };

    if (role) userFilter.role = role.toUpperCase();

    if (search) {
      const searchRegex = buildSearchRegex(search);
      userFilter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
      amoContactFilter.$or = [
        { name: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        { phones: searchRegex },
        { emails: searchRegex },
      ];
    }

    const userQuery = User.find(userFilter)
      .select("-password -refreshToken")
      .populate("purchasedBooks.product", "title price discountPrice image slug")
      .sort("-createdAt");
    const amoContactQuery =
      AmoContact.find(amoContactFilter).sort("-createdAt");

    if (!returnAll) {
      userQuery.skip(paginationParams.skip).limit(paginationParams.limit);
      amoContactQuery.skip(paginationParams.skip).limit(paginationParams.limit);
    }

    const [users, usersTotal, amoContacts, amoContactsTotal] =
      await Promise.all([
        userQuery,
        User.countDocuments(userFilter),
        amoContactQuery,
        AmoContact.countDocuments(amoContactFilter),
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
          limit: paginationParams.limit * 2,
        };

    apiResponse(res, 200, true, "Foydalanuvchilar ro'yxati", {
      users,
      amoContacts,
      items: [...users, ...amoContacts],
      pagination: buildPagination({
        ...combinedPaginationParams,
        total,
      }),
      usersPagination: buildPagination({
        ...usersPaginationParams,
        total: usersTotal,
      }),
      amoContactsPagination: buildPagination({
        ...amoContactsPaginationParams,
        total: amoContactsTotal,
      }),
      totals: {
        users: usersTotal,
        amoContacts: amoContactsTotal,
        all: total,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Admin tomonidan yangi foydalanuvchi yaratish
 */

const createUserAdmin = async (req, res, next) => {
  try {
    const {
      name,
      fullName,
      firstName,
      lastName,
      email,
      phone,
      telegramUsername,
      birthDate,
      password,
      role = "USER",
      isVerified,
      purchasedBooks,
      items,
    } = req.body;

    const hasEmail = email !== undefined && email !== null && email !== "";
    const hasPhone = phone !== undefined && phone !== null && phone !== "";
    const normalizedTelegramUsername =
      normalizeTelegramUsername(telegramUsername);
    const normalizedName = (
      name ||
      fullName ||
      [firstName, lastName].filter(Boolean).join(" ")
    )
      ?.toString()
      .trim();
    if (!normalizedName || normalizedName.length < 2) {
      return apiResponse(
        res,
        400,
        false,
        "Ism kamida 2 ta belgidan iborat bo'lishi kerak",
      );
    }

    const createData = { name: normalizedName };
    const duplicateChecks = [];

    if (!normalizedTelegramUsername) {
      return apiResponse(
        res,
        400,
        false,
        "Telegram username majburiy. Masalan @bookuz_admin",
      );
    }
    createData.telegramUsername = normalizedTelegramUsername;

    if (!hasEmail && !hasPhone) {
      return apiResponse(
        res,
        400,
        false,
        "Telefon raqam yoki email kiritilishi kerak",
      );
    }

    if (hasEmail) {
      const normalizedEmail = email.toString().trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        return apiResponse(res, 400, false, "Email formati noto'g'ri");
      }

      createData.email = normalizedEmail;
      duplicateChecks.push({ email: normalizedEmail });
    }

    if (hasPhone) {
      const { formattedPhone, duplicateChecks: phoneDuplicateChecks } =
        buildPhoneDuplicateChecks(phone);
      if (!isValidPhone(formattedPhone)) {
        return apiResponse(
          res,
          400,
          false,
          "Telefon raqam formati noto'g'ri. Masalan +998901234567",
        );
      }

      createData.phone = formattedPhone;
      duplicateChecks.push(...phoneDuplicateChecks);
    }

    const normalizedRole = normalizeAdminUserRole(role);
    if (!["USER", "ADMIN", "SUPERADMIN"].includes(normalizedRole)) {
      return apiResponse(
        res,
        400,
        false,
        "Role USER, ADMIN yoki SUPERADMIN bo'lishi kerak",
      );
    }

    if (duplicateChecks.length) {
      const existingUser = await User.findOne({ $or: duplicateChecks });
      if (existingUser) {
        const normalizedPurchasedBooks = await normalizePurchasedBooks(
          purchasedBooks || items,
        );

        existingUser.name = normalizedName;
        existingUser.role = normalizedRole;
        if (createData.email) existingUser.email = createData.email;
        if (createData.phone) existingUser.phone = createData.phone;
        existingUser.telegramUsername = createData.telegramUsername;
        if (birthDate) {
          const parsedBirthDate = new Date(birthDate);
          if (!Number.isNaN(parsedBirthDate.getTime())) {
            existingUser.birthDate = parsedBirthDate;
          }
        }
        if (normalizedPurchasedBooks.length) {
          existingUser.purchasedBooks = normalizedPurchasedBooks;
        }
        if (isVerified !== undefined) {
          existingUser.isVerified = Boolean(isVerified);
        }

        await existingUser.save();

        const userData = existingUser.toObject();
        delete userData.password;
        delete userData.refreshToken;

        return apiResponse(
          res,
          200,
          true,
          "Foydalanuvchi ma'lumotlari yangilandi",
          { user: userData, existing: true },
        );
      }
    }

    createData.role = normalizedRole;

    if (isVerified !== undefined) {
      createData.isVerified = Boolean(isVerified);
    }

    if (birthDate) {
      const parsedBirthDate = new Date(birthDate);
      if (!Number.isNaN(parsedBirthDate.getTime())) {
        createData.birthDate = parsedBirthDate;
      }
    }

    const normalizedPurchasedBooks = await normalizePurchasedBooks(
      purchasedBooks || items,
    );
    if (normalizedPurchasedBooks.length) {
      createData.purchasedBooks = normalizedPurchasedBooks;
    }

    const temporaryPassword = password ? null : generateTempPassword();
    const rawPassword = password || temporaryPassword;
    if (rawPassword.length < 6) {
      return apiResponse(
        res,
        400,
        false,
        "Parol kamida 6 ta belgidan iborat bo'lishi kerak",
      );
    }

    const salt = await bcrypt.genSalt(10);
    createData.password = await bcrypt.hash(rawPassword, salt);

    let user;
    try {
      user = await User.create(createData);
    } catch (error) {
      if (error.code === 11000) {
        const duplicateKeyChecks = Object.entries(error.keyValue || {}).map(
          ([key, value]) => ({ [key]: value }),
        );

        const existingUser = await User.findOne({
          $or: [...duplicateChecks, ...duplicateKeyChecks],
        });

        if (existingUser) {
          existingUser.name = normalizedName;
          existingUser.role = normalizedRole;
          if (createData.email) existingUser.email = createData.email;
          if (createData.phone) existingUser.phone = createData.phone;
          existingUser.telegramUsername = createData.telegramUsername;
          if (birthDate) {
            const parsedBirthDate = new Date(birthDate);
            if (!Number.isNaN(parsedBirthDate.getTime())) {
              existingUser.birthDate = parsedBirthDate;
            }
          }
          if (normalizedPurchasedBooks.length) {
            existingUser.purchasedBooks = normalizedPurchasedBooks;
          }
          if (isVerified !== undefined) {
            existingUser.isVerified = Boolean(isVerified);
          }

          await existingUser.save();

          const userData = existingUser.toObject();
          delete userData.password;
          delete userData.refreshToken;

          return apiResponse(
            res,
            200,
            true,
            "Foydalanuvchi ma'lumotlari yangilandi",
            { user: userData, existing: true },
          );
        }

        return apiResponse(
          res,
          400,
          false,
          "Bu telefon raqam yoki email oldin ro'yxatdan o'tgan",
          { duplicateKey: error.keyValue || null },
        );
      }

      throw error;
    }
    const userData = user.toObject();
    delete userData.password;
    delete userData.refreshToken;

    const responseData = { user: userData };
    if (temporaryPassword) responseData.temporaryPassword = temporaryPassword;

    apiResponse(res, 201, true, "Foydalanuvchi yaratildi", responseData);
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Foydalanuvchi ma'lumotlarini admin tomonidan tahrirlash
 * Ism, Email yoki Rolini (masalan USERdan ADMINga) o'zgartirish
 */

const updateUserAdmin = async (req, res, next) => {
  try {
    const {
      name,
      email,
      role,
      isVerified,
      telegramUsername,
      birthDate,
      purchasedBooks,
      items,
    } = req.body;
    const updateData = { name, email, isVerified };

    if (role !== undefined) {
      const normalizedRole = normalizeAdminUserRole(role);
      if (!["USER", "ADMIN", "SUPERADMIN"].includes(normalizedRole)) {
        return apiResponse(
          res,
          400,
          false,
          "Role USER, ADMIN yoki SUPERADMIN bo'lishi kerak",
        );
      }
      updateData.role = normalizedRole;
    }

    const normalizedTelegramUsername =
      normalizeTelegramUsername(telegramUsername);
    if (!normalizedTelegramUsername) {
      return apiResponse(
        res,
        400,
        false,
        "Telegram username majburiy. Masalan @bookuz_admin",
      );
    }
    updateData.telegramUsername = normalizedTelegramUsername;

    if (birthDate !== undefined) {
      if (!birthDate) {
        updateData.birthDate = undefined;
      } else {
        const parsedBirthDate = new Date(birthDate);
        if (Number.isNaN(parsedBirthDate.getTime())) {
          return apiResponse(res, 400, false, "Tug'ilgan sana noto'g'ri");
        }
        updateData.birthDate = parsedBirthDate;
      }
    }

    if (purchasedBooks !== undefined || items !== undefined) {
      updateData.purchasedBooks = await normalizePurchasedBooks(
        purchasedBooks || items,
      );
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true },
    ).select("-password");

    if (!user) return apiResponse(res, 404, false, "Foydalanuvchi topilmadi");

    apiResponse(res, 200, true, "Foydalanuvchi ma'lumotlari yangilandi", user);
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Foydalanuvchi parolini majburiy yangilash (Reset Password)
 * Agar user parolini yo'qotsa, admin unga yangi parol o'rnatib berishi uchun
 */

const resetUserPasswordAdmin = async (req, res, next) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return apiResponse(
        res,
        400,
        false,
        "Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak",
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const user = await User.findByIdAndUpdate(req.params.id, {
      password: hashedPassword,
    });

    if (!user) return apiResponse(res, 404, false, "Foydalanuvchi topilmadi");

    apiResponse(
      res,
      200,
      true,
      "Foydalanuvchi paroli muvaffaqiyatli yangilandi",
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Foydalanuvchini o'chirish yoki bloklash
 */

const deleteUserAdmin = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return apiResponse(res, 400, false, "O'zingizni o'chira olmaysiz!");
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return apiResponse(res, 404, false, "Foydalanuvchi topilmadi");

    apiResponse(res, 200, true, "Foydalanuvchi tizimdan o'chirildi");
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Bitta foydalanuvchining barcha aktivligi (Orderlari, Reviewlari)
 */

const getUserFullDetailsAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate(
        "purchasedBooks.product",
        "title price discountPrice image slug",
      );
    if (!user) return apiResponse(res, 404, false, "Foydalanuvchi topilmadi");

    const Order = require("../../models/Order");
    const orders = await Order.find({ user: user._id })
      .populate("items.product", "title price discountPrice image slug")
      .sort("-createdAt");

    apiResponse(res, 200, true, "Foydalanuvchi haqida to'liq ma'lumot", {
      user,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsersAdmin,
  createUserAdmin,
  updateUserAdmin,
  resetUserPasswordAdmin,
  deleteUserAdmin,
  getUserFullDetailsAdmin,
};
