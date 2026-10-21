const CashbackQrSession = require("../../models/CashbackQrSession");
const User = require("../../models/User");
const {
  getCashbackByPhone,
} = require("../../services/moyskladCashbackService");
const apiResponse = require("../../utils/apiResponse");
const { formatUzPhone, normalizePhone } = require("../../utils/phone");
const { isValidPhone } = require("../../utils/validator");

const buildPhoneVariants = (phone) => {
  const formattedPhone = formatUzPhone(phone);
  const digits = normalizePhone(formattedPhone);
  const localPhone = digits.startsWith("998") ? digits.slice(3) : digits;

  return [...new Set([formattedPhone, digits, localPhone, `0${localPhone}`])];
};

const scanCashbackQr = async (req, res, next) => {
  try {
    const qrValue = formatUzPhone(req.body.qrValue);

    if (!isValidPhone(qrValue)) {
      const error = new Error("QR-koddagi telefon raqami noto'g'ri");
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({
      phone: { $in: buildPhoneVariants(qrValue) },
    }).select("_id name phone telegramId");

    if (!user) {
      const error = new Error("Bu telefon raqamiga tegishli mijoz topilmadi");
      error.statusCode = 404;
      throw error;
    }

    const qrSession = await CashbackQrSession.findOne({
      user: user._id,
      status: "ACTIVE",
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!qrSession) {
      const error = new Error("QR-kod eskirgan yoki allaqachon ishlatilgan");
      error.statusCode = 400;
      throw error;
    }

    if (!user?.phone) {
      const error = new Error("Mijozning telefon raqami topilmadi");
      error.statusCode = 400;
      throw error;
    }

    // QR faqat mijozni aniqlaydi. Balans har safar MoySklad'dan qayta olinadi.
    const customer = await getCashbackByPhone(user.phone);

    return apiResponse(res, 200, true, "Cashback QR-kodi tekshirildi", {
      qrSessionId: qrSession._id,
      customer: {
        name: customer.name,
        phone: formatUzPhone(customer.phone),
      },
      cashback: {
        balance: customer.bonusPoints,
      },
      expiresAt: qrSession.expiresAt,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  scanCashbackQr,
};
