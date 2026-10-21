const crypto = require("crypto");

const MAX_AUTH_AGE_SECONDS = 10 * 60;

const createAuthError = (message) => {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
};

const verifyTelegramWebAppData = (initData) => {
  if (!initData || typeof initData !== "string") {
    throw createAuthError("Telegram initData topilmadi");
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  }
  const params = new URLSearchParams(initData);
  const receivedHashHex = params.get("hash");

  if (!receivedHashHex || !/^[a-f0-9]{64}$/i.test(receivedHashHex)) {
    throw createAuthError("Telegram Web App imzosi topilmadi");
  }

  // Hash hisoblanayotganda kelgan hashning o'zi qatnashmaydi.
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  // Mini App uchun secret key Login Widget algoritmidan farq qiladi.
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest();

  const receivedHash = Buffer.from(receivedHashHex, "hex");

  if (
    receivedHash.length !== calculatedHash.length ||
    !crypto.timingSafeEqual(receivedHash, calculatedHash)
  ) {
    throw createAuthError("Telegram Web App imzosi noto'g'ri");
  }

  const authDate = Number(params.get("auth_date"));
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const authAge = currentTimestamp - authDate;

  if (
    !Number.isInteger(authDate) ||
    authDate <= 0 ||
    authAge < -30 ||
    authAge > MAX_AUTH_AGE_SECONDS
  ) {
    throw createAuthError("Telegram Web App ma'lumoti eskirgan");
  }

  const rawUser = params.get("user");

  if (!rawUser) {
    throw createAuthError("Telegram foydalanuvchi ma'lumoti topilmadi");
  }

  let telegramUser;

  try {
    telegramUser = JSON.parse(rawUser);
  } catch {
    throw createAuthError("Telegram foydalanuvchi ma'lumoti noto'g'ri");
  }

  if (!telegramUser?.id) {
    throw createAuthError("Telegram foydalanuvchi IDsi topilmadi");
  }

  return {
    telegramId: String(telegramUser.id),
    firstName: String(telegramUser.first_name || ""),
    lastName: String(telegramUser.last_name || ""),
    username: String(telegramUser.username || ""),
    languageCode: String(telegramUser.language_code || ""),
    authDate,
  };
};

module.exports = {
  verifyTelegramWebAppData,
};
