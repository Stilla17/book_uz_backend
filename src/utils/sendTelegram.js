const TelegramBot = require('node-telegram-bot-api');
const User = require('../models/User');
const OTP = require('../models/OTP');

let bot;

const initTelegramBot = () => {
  if (bot) return bot;

  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

  bot.onText(/\/start (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const data = match[1];

    try {
      if (data.startsWith('reset_')) {
        const email = data.split('reset_')[1];
        const user = await User.findOne({ email });

        if (!user || user.telegramChatId !== chatId.toString()) {
          return bot.sendMessage(chatId, "Xatolik! Bu Telegram akkaunt ushbu Emailga ulanmagan.");
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.deleteMany({ userId: user._id });
        await OTP.create({ userId: user._id, otp, type: 'SMS' });

        return bot.sendMessage(chatId, `🔐 <b>Parolni tiklash kodi:</b> <code>${otp}</code>`, { parse_mode: 'HTML' });
      }

      const user = await User.findById(data);
      if (user) {
        user.telegramChatId = chatId.toString();
        await user.save();
        bot.sendMessage(chatId, "Profilingiz ulandi! ✅");
      }
    } catch (error) {
      console.log(error);
    }
  });

  return bot;
};

// Tashqaridan xabar yuborish uchun funksiya
// Tashqaridan xabar yuborish uchun funksiya

const sendTelegramOTP = async (chatId, otp) => {
  if (!bot) initTelegramBot();
  try {
    // Kichikroq va chiroyli rasm linki
    const imageUrl = "https://cdn-icons-png.flaticon.com/512/6195/6195699.png";

    const message = `
<a href="${imageUrl}">​​</a><b>📘 BOOK.UZ SUPPORT</b>
━━━━━━━━━━━━━━━━━━
<b>Parolni tiklash</b>

Assalomu alaykum! Tasdiqlash kodingiz:

<blockquote><b>${otp.split('').join(' ')}</b></blockquote>

<i>Kodni nusxalash uchun ustiga bosing.</i>
━━━━━━━━━━━━━━━━━━
🕒 Amal qilish muddati: 5 daqiqa.
@Bookuz_robot`;

    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: false, n
    });
    
    return true;
  } catch (error) {
    console.error('Telegramga yuborishda xatolik:', error.message);
    return false;
  }
};

module.exports = { initTelegramBot, sendTelegramOTP };