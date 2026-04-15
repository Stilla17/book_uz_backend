const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

class AuthService {
  // Token yaratish yordamchi funksiyasi
  generateTokens(userId) {
    const accessToken = jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
  }

  async register(userData) {
    const { email, password, name } = userData;

    // 1. Email bandligini tekshirish
    const userExists = await User.findOne({ email });
    if (userExists) throw new Error('Bu email allaqachon ro‘yxatdan o‘tgan');

    // 2. Parolni hash qilish
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. User yaratish
    const user = await User.create({
      name,
      email,
      password: hashedPassword
    });

    const tokens = this.generateTokens(user._id);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return { user, ...tokens };
  }

  async login(email, password) {
    const user = await User.findOne({ email });
    if (!user) throw new Error('Email yoki parol xato');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error('Email yoki parol xato');

    const tokens = this.generateTokens(user._id);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return { user, ...tokens };
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