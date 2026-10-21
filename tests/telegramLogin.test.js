const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const { verifyTelegramLogin } = require("../src/utils/telegramLogin");

const originalBotToken = process.env.TELEGRAM_BOT_TOKEN;
const botToken = "123456:test-token";

const signPayload = (payload) => {
  const dataCheckString = Object.entries(payload)
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto.createHash("sha256").update(botToken).digest();

  return crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
};

const createPayload = (overrides = {}) => {
  const payload = {
    id: "123456789",
    first_name: "Ali",
    username: "ali_test",
    auth_date: String(Math.floor(Date.now() / 1000)),
    ...overrides,
  };

  return { ...payload, hash: signPayload(payload) };
};

process.env.TELEGRAM_BOT_TOKEN = botToken;

after(() => {
  if (originalBotToken === undefined) {
    delete process.env.TELEGRAM_BOT_TOKEN;
  } else {
    process.env.TELEGRAM_BOT_TOKEN = originalBotToken;
  }
});

test("valid Telegram Login Widget payload is accepted", () => {
  const result = verifyTelegramLogin(createPayload());

  assert.equal(result.telegramId, "123456789");
  assert.equal(result.firstName, "Ali");
  assert.equal(result.username, "ali_test");
});

test("modified Telegram payload is rejected", () => {
  const payload = createPayload();
  payload.first_name = "Changed";

  assert.throws(
    () => verifyTelegramLogin(payload),
    /Telegram login imzosi noto'g'ri/,
  );
});

test("expired Telegram payload is rejected", () => {
  const payload = createPayload({
    auth_date: String(Math.floor(Date.now() / 1000) - 11 * 60),
  });

  assert.throws(
    () => verifyTelegramLogin(payload),
    /Telegram login ma'lumoti eskirgan/,
  );
});
