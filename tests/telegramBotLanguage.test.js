const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildLocalizedAboutMeMessage,
  buildHrNotificationMessage,
} = require("../src/services/telegramBotService");

const purchaseSummary = {
  ordersCount: 1,
  totalAmount: 125000,
  books: [{ name: "Test kitob", quantity: 2 }],
};

test("Telegram about-me xabari o'zbek tilida tuziladi", () => {
  const message = buildLocalizedAboutMeMessage({
    user: { name: "Ali", phone: "+998901234567" },
    website: purchaseSummary,
    moysklad: null,
    language: "uz",
  });

  assert.match(message, /Shaxsiy ma'lumotlar/);
  assert.match(message, /Buyurtmalar: 1/);
  assert.match(message, /125[\s\u00a0]?000 so'm/);
  assert.match(message, /2 dona/);
});

test("HR xabarida foydalanuvchi ma'lumotlari va xavfsiz matn ko'rsatiladi", () => {
  const message = buildHrNotificationMessage(
    {
      from: {
        id: 123456789,
        first_name: "Ali",
        last_name: "Valiyev",
        username: "ali_book",
      },
      text: "Salom <script>",
    },
    { phone: "+998901234567" },
  );

  assert.match(message, /Ali Valiyev/);
  assert.match(message, /@ali_book/);
  assert.match(message, /123456789/);
  assert.match(message, /\+998901234567/);
  assert.match(message, /Salom &lt;script&gt;/);
  assert.doesNotMatch(message, /Salom <script>/);
});

test("Telegram about-me xabari rus tilida tuziladi", () => {
  const message = buildLocalizedAboutMeMessage({
    user: { name: "Али", phone: "+998901234567" },
    website: purchaseSummary,
    moysklad: null,
    language: "ru",
  });

  assert.match(message, /Личные данные/);
  assert.match(message, /Заказы: 1/);
  assert.match(message, /125[\s\u00a0]?000 сум/);
  assert.match(message, /2 шт\./);
});
