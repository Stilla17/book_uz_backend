const User = require('../../models/User');
const OTP = require('../../models/OTP');
const sendEmail = require('../../utils/sendEmail');
const apiResponse = require('../../utils/apiResponse');
const { sendTelegramOTP } = require('../../utils/sendTelegram');
const bcrypt = require('bcrypt');

// 1. OTP Yuborish (Forgot Password)

exports.forgotPassword = async (req, res, next) => {
    try {
        const { email, method } = req.body; 

        const user = await User.findOne({ email });
        if (!user) return apiResponse(res, 404, false, "Foydalanuvchi topilmadi");

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await OTP.deleteMany({ userId: user._id });
        await OTP.create({ userId: user._id, otp, type: method === 'TELEGRAM' ? 'SMS' : 'EMAIL' });

        if (method === 'TELEGRAM') {
            if (!user.telegramChatId) {
                return apiResponse(res, 400, false, "Profilingizda Telegram ulanmagan. Iltimos, Email usulini tanlang.");
            }

            console.log("Yuborilayotgan Chat ID:", user.telegramChatId);

           const sent = await sendTelegramOTP(user.telegramChatId, otp);
            if (sent) {
                return apiResponse(res, 200, true, "Tasdiqlash kodi Telegram botingizga yuborildi");
            } else {
                return apiResponse(res, 500, false, "Telegramga yuborishda xatolik yuz berdi");
            }
        }

        else {
            try {
                await sendEmail({
                    email: user.email,
                    subject: "Parolni qayta tiklash kodi",
                    otp
                });
                return apiResponse(res, 200, true, "Tasdiqlash kodi emailga yuborildi");
            } catch (err) {
                return apiResponse(res, 500, false, "Email yuborishda xatolik yuz berdi");
            }
        }

    } catch (error) { next(error); }
};

// 2. OTP-ni tasdiqlash va Parolni yangilash

exports.resetPassword = async (req, res, next) => {
    try {
        const { email, otp, newPassword } = req.body;

        const user = await User.findOne({ email });
        if (!user) return apiResponse(res, 404, false, "Foydalanuvchi topilmadi");

        const validOtp = await OTP.findOne({ userId: user._id, otp });
        if (!validOtp) {
            return apiResponse(res, 400, false, "Kod xato yoki muddati o'tgan");
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        user.password = hashedPassword;

        user.refreshToken = null;
        await user.save();

        await OTP.deleteOne({ _id: validOtp._id });

        apiResponse(res, 200, true, "Parol muvaffaqiyatli yangilandi. Endi login qilishingiz mumkin.");
    } catch (error) { next(error); }
};