const authService = require('../../services/authService');
const apiResponse = require('../../utils/apiResponse');

// Cookie sozlamalari (Production va Development uchun)

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Lax', 
  maxAge: 30 * 24 * 60 * 60 * 1000, 
};

/**
 * 1. Ro'yxatdan o'tish
 */

const register = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.register(req.body);

    res.cookie('refreshToken', refreshToken, cookieOptions);

    apiResponse(res, 201, true, "Ro'yxatdan muvaffaqiyatli o'tdingiz", { user, accessToken });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Tizimga kirish (Login)
 */
const login = async (req, res, next) => {
  try {
    const { email, password, wishlist, wishlistProductIds, productIds } = req.body;
    const { user, accessToken, refreshToken } = await authService.login(email, password, {
      wishlist: wishlistProductIds || productIds || wishlist,
    });

    res.cookie('refreshToken', refreshToken, cookieOptions);

    apiResponse(res, 200, true, "Tizimga kirildi", { user, accessToken });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Tokenni yangilash (Refresh Token)
 * Foydalanuvchi sahifani yangilaganda yoki accessToken muddati tugaganda ishlaydi
 */

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    
    if (!refreshToken) {
      return apiResponse(res, 401, false, "Refresh token topilmadi, iltimos login qiling");
    }

    const result = await authService.refreshToken(refreshToken);
    
    res.cookie('refreshToken', result.refreshToken, cookieOptions);

    apiResponse(res, 200, true, "Token yangilandi", { 
      user: result.user, 
      accessToken: result.accessToken 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Tizimdan chiqish (Logout)
 */

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    
    await authService.logout(refreshToken);

    res.clearCookie('refreshToken');
    
    apiResponse(res, 200, true, "Tizimdan chiqildi");
  } catch (error) {
    next(error);
  }
};

module.exports = { 
  register, 
  login, 
  refresh, 
  logout 
};
