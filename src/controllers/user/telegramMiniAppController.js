const User = require("../../models/User");
const apiResponse = require("../../utils/apiResponse");
const { verifyTelegramWebAppData } = require("../../utils/telegramWebApp");
const {
  getCashbackByPhone,
} = require("../../services/moyskladCashbackService");
const crypto = require("crypto");
const CashbackQrSession = require("../../models/CashbackQrSession");
const { formatUzPhone } = require("../../utils/phone");

const createMiniAppSession = async (req, res, next) => {
  try {
    const authorization = String(req.headers.authorization || "");

    if (!authorization.startsWith("tma ")) {
      const error = new Error("Telegram Mini App avtorizatsiyasi topilmadi");
      error.statusCode = 401;
      throw error;
    }

    const initData = authorization.slice(4).trim();

    const telegramProfile = verifyTelegramWebAppData(initData);

    const user = await User.findOne({
      telegramId: telegramProfile.telegramId,
    }).select("_id name phone telegramId telegramUsername phoneVerified");

    if (!user) {
      const error = new Error("Telegram foydalanuvchisi bazadan topilmadi");
      error.statusCode = 404;
      throw error;
    }

    if (!user.phone) {
      const error = new Error(
        "Telefon raqamingiz Telegram botga biriktirilmagan",
      );
      error.statusCode = 400;
      throw error;
    }

    return apiResponse(
      res,
      200,
      true,
      "Telegram Mini App sessiyasi tasdiqlandi",
      {
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          telegramId: user.telegramId,
          telegramUsername: user.telegramUsername,
          phoneVerified: user.phoneVerified,
        },
      },
    );
  } catch (error) {
    next(error);
  }
};

const getMiniAppCashback = async (req, res, next) => {
  try {
    const authorization = String(req.headers.authorization || "");

    if (!authorization.startsWith("tma ")) {
      const error = new Error("Telegram Mini App auth topilmadi");
      error.statusCode = 401;
      throw error;
    }

    const initData = authorization.slice(4).trim();
    const telegramProfile = verifyTelegramWebAppData(initData);

    const user = await User.findOne({
      telegramId: telegramProfile.telegramId,
    }).select("_id name phone telegramId");

    if (!user) {
      const error = new Error("Telegram foydalanuvchisi bazadan topilmadi");
      error.statusCode = 404;
      throw error;
    }

    if (!user.phone) {
      const error = new Error(
        "Telefon raqamingiz Telegram botga biriktirilmagan",
      );
      error.statusCode = 400;
      throw error;
    }

    const customer = await getCashbackByPhone(user.phone);

    return apiResponse(res, 200, true, "Cashback balansi olindi", {
      customer: {
        name: customer.name,
        phone: customer.phone,
      },
      balance: customer.bonusPoints,
    });
  } catch (error) {
    next(error);
  }
};

const createCashbackQr = async (req, res, next) => {
  try {
    const authorization = String(req.headers.authorization || "");

    if (!authorization.startsWith("tma ")) {
      const error = new Error("Telegram Mini App avtorizatsiyasi topilmadi");
      error.statusCode = 401;
      throw error;
    }

    const initData = authorization.slice(4).trim();

    const telegramProfile = verifyTelegramWebAppData(initData);

    const user = await User.findOne({
      telegramId: telegramProfile.telegramId,
    }).select("_id name phone telegramId");

    if (!user) {
      const error = new Error("Telegram foydalanuvchisi bazadan topilmadi");
      error.statusCode = 404;
      throw error;
    }

    if (!user.phone) {
      const error = new Error(
        "Telefon raqamingiz Telegram botga biriktirilmagan",
      );
      error.statusCode = 400;
      throw error;
    }

    // Shu foydalanuvchining oldingi aktiv QR'larini bekor qilamiz.
    await CashbackQrSession.updateMany(
      {
        user: user._id,
        status: "ACTIVE",
      },
      {
        $set: {
          status: "EXPIRED",
        },
      },
    );

    const token = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const expiresAt = new Date(Date.now() + 60 * 1000);

    await CashbackQrSession.create({
      tokenHash,
      user: user._id,
      telegramId: user.telegramId,
      status: "ACTIVE",
      expiresAt,
    });

    return apiResponse(res, 201, true, "Cashback QR sessiyasi yaratildi", {
      qrValue: formatUzPhone(user.phone),
      expiresAt,
      validForSeconds: 60,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createMiniAppSession,
  getMiniAppCashback,
  createCashbackQr,
};
