const crypto = require("crypto");

const MAX_AUTH_AGE_SECONDS = 10 * 60;

const createAuthError = (message) => {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
};

const verifyTelegramLogin = (payload = {}) => {
  const hash = String(payload.hash || "");

  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    throw createAuthError("Telegram login imzosi topilmadi");
  }

  const telegramId = String(payload.id || "");
  if (!/^\d+$/.test(telegramId)) {
    throw createAuthError("Telegram foydalanuvchi IDsi noto'g'ri");
  }

  const authDate = Number(payload.auth_date);
  if (!Number.isInteger(authDate) || authDate <= 0) {
    throw createAuthError("Telegram login vaqti noto'g'ri");
  }

  const age = Math.floor(Date.now() / 1000) - authDate;

  if (age < 0 || age > MAX_AUTH_AGE_SECONDS) {
    throw createAuthError("Telegram login ma'lumoti eskirgan");
  }

  const dataCheckString = Object.entries(payload)
    .filter(
      ([key, value]) => key !== "hash" && value !== undefined && value !== null,
    )
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  }

  const secretKey = crypto
    .createHash("sha256")
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest();
  const receivedHash = Buffer.from(hash, "hex");

  if (
    receivedHash.length !== calculatedHash.length ||
    !crypto.timingSafeEqual(receivedHash, calculatedHash)
  ) {
    throw createAuthError("Telegram login imzosi noto'g'ri");
  }

  return {
    telegramId,
    firstName: String(payload.first_name || ""),
    lastName: String(payload.last_name || ""),
    username: String(payload.username || ""),
    photoUrl: String(payload.photo_url || ""),
  };
};

module.exports = {
  verifyTelegramLogin,
};
