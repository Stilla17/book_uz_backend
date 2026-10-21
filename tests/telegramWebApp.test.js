const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const originalToken = process.env.TELEGRAM_BOT_TOKEN;
process.env.TELEGRAM_BOT_TOKEN = "123456:test-token";

const {
  verifyTelegramWebAppData,
} = require("../src/utils/telegramWebApp");

const createInitData = ({ authDate, user, extra = {} }) => {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "test-query",
    user: JSON.stringify(user),
    ...extra,
  });
  const dataCheckString = [...params.entries()]
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  params.set("hash", hash);
  return params.toString();
};

after(() => {
  if (originalToken === undefined) {
    delete process.env.TELEGRAM_BOT_TOKEN;
  } else {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
  }
});

test("valid Telegram Mini App initData is accepted", () => {
  const initData = createInitData({
    authDate: Math.floor(Date.now() / 1000),
    user: {
      id: 123456789,
      first_name: "Ali",
      username: "ali_bookuz",
    },
  });

  assert.deepEqual(verifyTelegramWebAppData(initData), {
    telegramId: "123456789",
    firstName: "Ali",
    lastName: "",
    username: "ali_bookuz",
    languageCode: "",
    authDate: Number(new URLSearchParams(initData).get("auth_date")),
  });
});

test("modified Telegram Mini App initData is rejected", () => {
  const initData = createInitData({
    authDate: Math.floor(Date.now() / 1000),
    user: { id: 123456789, first_name: "Ali" },
  }).replace("Ali", "Vali");

  assert.throws(
    () => verifyTelegramWebAppData(initData),
    /Telegram Web App imzosi noto'g'ri/,
  );
});

test("expired Telegram Mini App initData is rejected", () => {
  const initData = createInitData({
    authDate: Math.floor(Date.now() / 1000) - 11 * 60,
    user: { id: 123456789, first_name: "Ali" },
  });

  assert.throws(
    () => verifyTelegramWebAppData(initData),
    /Telegram Web App ma'lumoti eskirgan/,
  );
});
