const User = require("../models/User");
const Product = require("../models/Product");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const OTP = require("../models/OTP");
const { isValidPhone } = require("../utils/validator");
const sendEskizSms = require("../utils/sendEskizSms");

const normalizeWishlistProductIds = (wishlist = []) => {
  const source = Array.isArray(wishlist) ? wishlist : [];

  return [
    ...new Set(
      source
        .map((item) => {
          if (item && typeof item === "object") {
            return item.productId || item.product || item._id || item.id;
          }

          return item;
        })
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => id.toString()),
    ),
  ];
};

const buildPhoneOtpMessage = (otp) => {
  const template =
    process.env.ESKIZ_OTP_TEMPLATE || "Book.uz tasdiqlash kodi: {code}";

  return template
    .replaceAll("{code}", otp)
    .replaceAll("{{code}}", otp)
    .replaceAll("%CODE%", otp)
    .replaceAll("%d", otp)
    .replaceAll("0000", otp);
};

const sanitizeUser = (user) => {
  const userObject =
    typeof user.toObject === "function" ? user.toObject() : { ...user };
  delete userObject.password;
  delete userObject.refreshToken;
  return userObject;
};

class AuthService {
  // Token yaratish yordamchi funksiyasi
  generateTokens(userId) {
    const accessToken = jwt.sign(
      { id: userId },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRE || "1d" },
    );
    const refreshToken = jwt.sign(
      { id: userId },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || "7d" },
    );
    return { accessToken, refreshToken };
  }

  async register(userData) {
    const { email, password, name, wishlist, wishlistProductIds, productIds } =
      userData;

    // 1. Email bandligini tekshirish
    const userExists = await User.findOne({ email });
    if (userExists) throw new Error("Bu email allaqachon ro‘yxatdan o‘tgan");

    // 2. Parolni hash qilish
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. User yaratish
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const tokens = this.generateTokens(user._id);
    user.refreshToken = tokens.refreshToken;
    await this.mergeWishlist(
      user,
      wishlistProductIds || productIds || wishlist,
    );
    await user.save();

    return { user: sanitizeUser(user), ...tokens };
  }

  async login(email, password, options = {}) {
    const user = await User.findOne({ email });
    if (!user) throw new Error("Email yoki parol xato");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("Email yoki parol xato");

    const tokens = this.generateTokens(user._id);
    user.refreshToken = tokens.refreshToken;
    await this.mergeWishlist(user, options.wishlist);
    await user.save();

    return { user: sanitizeUser(user), ...tokens };
  }

  async sendPhoneOtp({ phone, name }) {
    if (!isValidPhone(phone)) {
      throw new Error("Telefon raqam formati noto'g'ri. Masalan +998901234567");
    }
    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({
        name: name || "Foydalanuvchi",
        phone,
        isVerified: false,
      });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    await OTP.deleteMany({ userId: user._id, type: "SMS" });
    await OTP.create({ userId: user._id, otp, type: "SMS" });

    await sendEskizSms(phone, buildPhoneOtpMessage(otp));

    console.log(`Phone OTP for ${phone}: ${otp}`);
    return { phone };
  }

  async verifyPhoneOtp({ phone, otp, wishlist }) {
    if (!isValidPhone(phone)) {
      throw new Error("Telefon raqam formati noto'g'ri");
    }

    const user = await User.findOne({ phone });
    if (!user) {
      throw new Error("Telefon raqamiga mos foydalanuvchi topilmadi");
    }
    const validOtp = await OTP.findOne({ userId: user._id, otp, type: "SMS" });
    if (!validOtp) {
      throw new Error("OTP noto'g'ri yoki muddati tugagan");
    }

    await OTP.deleteOne({ _id: validOtp._id });
    user.isVerified = true;
    const tokens = this.generateTokens(user._id);
    user.refreshToken = tokens.refreshToken;
    await this.mergeWishlist(user, wishlist);
    await user.save();

    return { user: sanitizeUser(user), ...tokens };
  }

  async mergeWishlist(user, wishlist) {
    const productIds = normalizeWishlistProductIds(wishlist);

    if (!productIds.length) {
      return user;
    }

    const existingProductIds = await Product.find({
      _id: { $in: productIds },
    }).distinct("_id");
    const wishlistSet = new Set([
      ...(user.wishlist || []).map((id) => id.toString()),
      ...existingProductIds.map((id) => id.toString()),
    ]);

    user.wishlist = [...wishlistSet];
    return user;
  }

  async refreshToken(oldRefreshToken) {
    if (!oldRefreshToken) throw new Error("Refresh token topilmadi");

    let payload;
    try {
      payload = jwt.verify(oldRefreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (e) {
      throw new Error("Refresh token yaroqsiz yoki muddati tugagan");
    }

    // user topamiz
    const user = await User.findById(payload.id);
    if (!user) throw new Error("Foydalanuvchi topilmadi");

    // refresh token mosligini tekshiramiz (DBdagi bilan)
    if (!user.refreshToken || user.refreshToken !== oldRefreshToken) {
      throw new Error("Refresh token mos emas, qayta login qiling");
    }

    // yangi tokenlar
    const tokens = this.generateTokens(user._id);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    user.password = undefined;
    user.refreshToken = undefined;

    return { user, ...tokens };
  }

  async logout(refreshToken) {
    if (!refreshToken) return true;

    const user = await User.findOne({ refreshToken });
    if (user) {
      user.refreshToken = null;
      await user.save();
    }

    return true;
  }
}

module.exports = new AuthService();
