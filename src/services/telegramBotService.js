const TelegramBot = require("node-telegram-bot-api");
const { getCashbackByPhone } = require("./moyskladCashbackService");
const {
  getWebsitePurchases,
  getMoyskladPurchases,
} = require("./customerPurchaseService");
const User = require("../models/User");
const TelegramBotPreference = require("../models/TelegramBotPreference");
const { formatUzPhone, normalizePhone } = require("../utils/phone");
const { isValidPhone } = require("../utils/validator");

let bot = null;
let isStoppingPolling = false;

const translations = {
  uz: {
    welcome: "Assalomu alaykum! Book.uz botiga xush kelibsiz.",
    chooseSection: "Kerakli bo'limni tanlang:",
    cashbackButton: "💰 Cashback",
    phoneButton: "📱 Telefon raqamimni yuborish",
    phoneHint:
      "Telefon raqamingiz hali bog'lanmagan bo'lsa, pastdagi tugma orqali yuboring.",
    languageSaved: "Til o'zbekchaga o'zgartirildi.",
    needPhoneCashback:
      "Cashbackni ko'rish uchun telefon raqamingizni bir marta yuboring.",
    checkingCashback: "Cashback tekshirilmoqda...",
    balanceTitle: "Cashback balansingiz",
    customerLabel: "Mijoz",
    bonusLabel: "Bonus",
    pointsUnit: "ball",
    cashbackTemporaryError:
      "Cashbackni olishda vaqtinchalik xatolik yuz berdi.",
    needPhonePurchases:
      "Xaridlaringizni ko'rish uchun telefon raqamingizni bir marta yuboring.",
    checkingPurchases: "Xaridlaringiz tekshirilmoqda...",
    purchasesTemporaryError:
      "Xarid ma'lumotlarini olishda vaqtinchalik xatolik yuz berdi.",
    ownContactOnly:
      "Faqat o'zingizga tegishli telefon raqamini yuborishingiz mumkin.",
    linkingPhone: "Telefon raqamingiz bog'lanmoqda...",
    linkedCashbackError:
      "Telefon raqamingiz saqlandi, ammo cashbackni olishda vaqtinchalik xatolik yuz berdi. Keyinroq qayta urinib ko'ring.",
    personalData: "Shaxsiy ma'lumotlar",
    nameLabel: "Ism",
    phoneLabel: "Telefon",
    notProvided: "Ko'rsatilmagan",
    websitePurchases: "Sayt orqali xaridlar",
    storePurchases: "Do'kon xaridlari",
    ordersLabel: "Buyurtmalar",
    salesLabel: "Sotuvlar",
    noData: "Ma'lumotni olib bo'lmadi.",
    totalAmount: "Jami summa",
    noBooks: "Sotib olingan kitoblar topilmadi.",
    purchasedBooks: "Sotib olingan kitoblar:",
    moreBooks: (count) => `... yana ${count} ta kitob`,
    bookQuantity: (quantity) => `${quantity} dona`,
    otpTitle: "Parolni tiklash",
    otpCode: "Tasdiqlash kodingiz:",
    otpExpires: "Kod 5 daqiqa amal qiladi.",
  },
  ru: {
    welcome: "Здравствуйте! Добро пожаловать в бот Book.uz.",
    chooseSection: "Выберите нужный раздел:",
    cashbackButton: "💰 Кешбэк",
    phoneButton: "📱 Отправить мой номер",
    phoneHint:
      "Если номер телефона ещё не привязан, отправьте его кнопкой ниже.",
    languageSaved: "Язык изменён на русский.",
    needPhoneCashback:
      "Чтобы посмотреть кешбэк, один раз отправьте свой номер телефона.",
    checkingCashback: "Проверяем кешбэк...",
    balanceTitle: "Ваш баланс кешбэка",
    customerLabel: "Клиент",
    bonusLabel: "Бонусы",
    pointsUnit: "баллов",
    cashbackTemporaryError:
      "При получении кешбэка произошла временная ошибка.",
    needPhonePurchases:
      "Чтобы посмотреть покупки, один раз отправьте свой номер телефона.",
    checkingPurchases: "Проверяем ваши покупки...",
    purchasesTemporaryError:
      "При получении данных о покупках произошла временная ошибка.",
    ownContactOnly: "Можно отправить только свой номер телефона.",
    linkingPhone: "Привязываем ваш номер телефона...",
    linkedCashbackError:
      "Номер телефона сохранён, но кешбэк временно недоступен. Попробуйте позже.",
    personalData: "Личные данные",
    nameLabel: "Имя",
    phoneLabel: "Телефон",
    notProvided: "Не указано",
    websitePurchases: "Покупки на сайте",
    storePurchases: "Покупки в магазине",
    ordersLabel: "Заказы",
    salesLabel: "Продажи",
    noData: "Не удалось получить данные.",
    totalAmount: "Общая сумма",
    noBooks: "Купленные книги не найдены.",
    purchasedBooks: "Купленные книги:",
    moreBooks: (count) => `... ещё ${count} книг`,
    bookQuantity: (quantity) => `${quantity} шт.`,
    otpTitle: "Восстановление пароля",
    otpCode: "Ваш код подтверждения:",
    otpExpires: "Код действует 5 минут.",
  },
};

const normalizeLanguage = (language) => (language === "ru" ? "ru" : "uz");
const t = (language, key, ...args) => {
  const value = translations[normalizeLanguage(language)][key];
  return typeof value === "function" ? value(...args) : value;
};

const getUserLanguage = async (telegramId, user = null) => {
  if (user?.preferences?.language === "ru") return "ru";

  const preference = await TelegramBotPreference.findOne({ telegramId })
    .select("language")
    .lean();

  return normalizeLanguage(preference?.language);
};

const getTelegramErrorMessage = (error) =>
  error?.response?.body?.description ||
  error?.message ||
  "Noma'lum Telegram xatosi";

const logCashbackError = (label, error) => {
  const responseData = error?.response?.data;
  const telegramBody = error?.response?.body;

  console.error(label, {
    name: error?.name,
    message: error?.message || "Noma'lum xatolik",
    code: error?.code,
    httpStatus: error?.response?.status || error?.response?.statusCode,
    response: responseData || telegramBody,
    method: error?.config?.method?.toUpperCase(),
    url: error?.config?.url,
  });

  if (error?.stack) {
    console.error(`${label} stack:`, error.stack);
  }
};

const formatMoney = (value) =>
  `${Math.round(Number(value || 0)).toLocaleString("uz-UZ")} so'm`;

const truncate = (value, maxLength = 80) => {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const buildHrNotificationMessage = (msg, user = null) => {
  const telegramName = [msg.from?.first_name, msg.from?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const username = msg.from?.username
    ? `@${msg.from.username}`
    : user?.telegramUsername || "Ko'rsatilmagan";
  const phone = user?.phone || "Ko'rsatilmagan";

  return [
    "<b>Yangi Telegram murojaati</b>",
    "",
    `<b>Ism:</b> ${escapeHtml(telegramName || user?.name || "Ko'rsatilmagan")}`,
    `<b>Username:</b> ${escapeHtml(username)}`,
    `<b>Telegram ID:</b> <code>${escapeHtml(msg.from?.id)}</code>`,
    `<b>Telefon:</b> ${escapeHtml(phone)}`,
    "",
    "<b>Xabar:</b>",
    escapeHtml(truncate(msg.text?.trim(), 3000)),
  ].join("\n");
};

const buildPhoneVariants = (phone) => {
  const formattedPhone = formatUzPhone(phone);
  const phoneDigits = normalizePhone(formattedPhone);
  const localPhone = phoneDigits.startsWith("998")
    ? phoneDigits.slice(3)
    : phoneDigits;

  return [
    formattedPhone,
    phoneDigits,
    localPhone,
    phoneDigits ? `+${phoneDigits}` : "",
    localPhone ? `+998${localPhone}` : "",
  ].filter(Boolean);
};

const formatPurchaseSection = (title, summary, countLabel) => {
  if (!summary) return [title, "Ma'lumotni olib bo'lmadi."];

  const books = summary.books || [];
  const visibleBooks = books.slice(0, 15);
  const lines = [
    title,
    `${countLabel}: ${summary.ordersCount ?? summary.salesCount ?? 0}`,
    `Jami summa: ${formatMoney(summary.totalAmount)}`,
  ];

  if (!visibleBooks.length) {
    lines.push("Sotib olingan kitoblar topilmadi.");
    return lines;
  }

  lines.push("Sotib olingan kitoblar:");
  visibleBooks.forEach((book, index) => {
    lines.push(`${index + 1}. ${truncate(book.name)} — ${book.quantity} dona`);
  });

  if (books.length > visibleBooks.length) {
    lines.push(`... yana ${books.length - visibleBooks.length} ta kitob`);
  }

  return lines;
};

const buildAboutMeMessage = ({ user, website, moysklad }) =>
  [
    "Shaxsiy ma'lumotlar",
    `Ism: ${user.name || "Ko'rsatilmagan"}`,
    `Telefon: ${user.phone || "Ko'rsatilmagan"}`,
    "",
    ...formatPurchaseSection("Sayt orqali xaridlar", website, "Buyurtmalar"),
    "",
    ...formatPurchaseSection("Do'kon xaridlari", moysklad, "Sotuvlar"),
  ].join("\n");

const formatLocalizedMoney = (value, language) =>
  `${Math.round(Number(value || 0)).toLocaleString(language === "ru" ? "ru-RU" : "uz-UZ")} ${language === "ru" ? "сум" : "so'm"}`;

const formatLocalizedPoints = (value, language) =>
  `${Number(value || 0).toLocaleString(language === "ru" ? "ru-RU" : "uz-UZ")} ${t(language, "pointsUnit")}`;

const formatLocalizedPurchaseSection = (
  title,
  summary,
  countLabel,
  language,
) => {
  if (!summary) return [title, t(language, "noData")];

  const books = summary.books || [];
  const visibleBooks = books.slice(0, 15);
  const lines = [
    title,
    `${countLabel}: ${summary.ordersCount ?? summary.salesCount ?? 0}`,
    `${t(language, "totalAmount")}: ${formatLocalizedMoney(summary.totalAmount, language)}`,
  ];

  if (!visibleBooks.length) {
    lines.push(t(language, "noBooks"));
    return lines;
  }

  lines.push(t(language, "purchasedBooks"));
  visibleBooks.forEach((book, index) => {
    lines.push(
      `${index + 1}. ${truncate(book.name)} — ${t(language, "bookQuantity", book.quantity)}`,
    );
  });

  if (books.length > visibleBooks.length) {
    lines.push(t(language, "moreBooks", books.length - visibleBooks.length));
  }

  return lines;
};

const buildLocalizedAboutMeMessage = ({
  user,
  website,
  moysklad,
  language,
}) =>
  [
    t(language, "personalData"),
    `${t(language, "nameLabel")}: ${user.name || t(language, "notProvided")}`,
    `${t(language, "phoneLabel")}: ${user.phone || t(language, "notProvided")}`,
    "",
    ...formatLocalizedPurchaseSection(
      t(language, "websitePurchases"),
      website,
      t(language, "ordersLabel"),
      language,
    ),
    "",
    ...formatLocalizedPurchaseSection(
      t(language, "storePurchases"),
      moysklad,
      t(language, "salesLabel"),
      language,
    ),
  ].join("\n");

const localizedErrors = {
  "Bu telefon raqami MoySklad'da topilmadi": {
    uz: "Bu telefon raqami MoySklad'da topilmadi",
    ru: "Этот номер телефона не найден в МойСклад",
  },
  "Bu telefon raqamiga bir nechta mijoz bog'langan. Administratorga murojaat qiling": {
    uz: "Bu telefon raqamiga bir nechta mijoz bog'langan. Administratorga murojaat qiling",
    ru: "К этому номеру привязано несколько клиентов. Обратитесь к администратору",
  },
  "Telefon raqami noto'g'ri": {
    uz: "Telefon raqami noto'g'ri",
    ru: "Неверный номер телефона",
  },
  "Telegram va telefon boshqa profillarga bog'langan. Administratorga murojaat qiling": {
    uz: "Telegram va telefon boshqa profillarga bog'langan. Administratorga murojaat qiling",
    ru: "Telegram и телефон привязаны к разным профилям. Обратитесь к администратору",
  },
  "Bu telefon raqami boshqa Telegram akkauntiga bog'langan. Administratorga murojaat qiling": {
    uz: "Bu telefon raqami boshqa Telegram akkauntiga bog'langan. Administratorga murojaat qiling",
    ru: "Этот номер привязан к другому аккаунту Telegram. Обратитесь к администратору",
  },
  "Telegram akkauntingiz boshqa telefon raqamiga bog'langan. Administratorga murojaat qiling": {
    uz: "Telegram akkauntingiz boshqa telefon raqamiga bog'langan. Administratorga murojaat qiling",
    ru: "Ваш аккаунт Telegram привязан к другому номеру. Обратитесь к администратору",
  },
};

const localizeKnownError = (message, language, fallbackKey) =>
  localizedErrors[message]?.[normalizeLanguage(language)] ||
  t(language, fallbackKey);

const getContactKeyboard = (language) => ({
  keyboard: [
    [
      {
        text: t(language, "phoneButton"),
        request_contact: true,
      },
    ],
  ],
  resize_keyboard: true,
  is_persistent: true,
});

const sendMainMenu = async (telegramBot, chatId, language) => {
  const webAppUrl = process.env.TELEGRAM_WEB_APP_URL;
  const options = webAppUrl
    ? {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: t(language, "cashbackButton"),
                web_app: { url: webAppUrl },
              },
            ],
          ],
        },
      }
    : undefined;

  await telegramBot.sendMessage(
    chatId,
    [t(language, "welcome"), "", t(language, "chooseSection")].join("\n"),
    options,
  );

  return telegramBot.sendMessage(chatId, t(language, "phoneHint"), {
    reply_markup: getContactKeyboard(language),
  });
};

const initTelegramBot = () => {
  if (bot) return bot;

  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN topilmadi");
  }

  const pollingEnabled = process.env.TELEGRAM_POLLING_ENABLED !== "false";
  bot = new TelegramBot(token, { polling: pollingEnabled });

  if (!pollingEnabled) {
    console.log(
      "Telegram polling o'chirilgan (TELEGRAM_POLLING_ENABLED=false)",
    );
  }

  bot.onText(/^\/cashback(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from.id);
    let loadingMessage;
    let language = "uz";

    try {
      const user = await User.findOne({ telegramId });
      language = await getUserLanguage(telegramId, user);

      if (!user?.phone) {
        await bot.sendMessage(
          chatId,
          t(language, "needPhoneCashback"),
          {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: t(language, "phoneButton"),
                    request_contact: true,
                  },
                ],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          },
        );

        return;
      }

      loadingMessage = await bot.sendMessage(
        chatId,
        t(language, "checkingCashback"),
      );

      const customer = await getCashbackByPhone(user.phone);
      const bonus = formatLocalizedPoints(customer.bonusPoints, language);

      await bot.sendMessage(
        chatId,
        [
          t(language, "balanceTitle"),
          "",
          `${t(language, "customerLabel")}: ${customer.name}`,
          `${t(language, "bonusLabel")}: ${bonus}`,
        ].join("\n"),
      );
    } catch (error) {
      logCashbackError("Cashback komandasi xatosi:", error);

      const message = localizeKnownError(
        error.message,
        language,
        "cashbackTemporaryError",
      );

      await bot.sendMessage(chatId, message).catch((sendError) => {
        console.error(
          "Telegram xabar yuborish xatosi:",
          getTelegramErrorMessage(sendError),
        );
      });
    } finally {
      if (loadingMessage?.message_id) {
        await bot
          .deleteMessage(chatId, loadingMessage.message_id)
          .catch((error) => {
            console.error(
              "Cashback loading xabarini o'chirishda xatolik:",
              getTelegramErrorMessage(error),
            );
          });
      }
    }
  });

  bot.onText(/^\/legacy-start-disabled(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const webAppUrl = process.env.TELEGRAM_WEB_APP_URL;

    await bot.sendMessage(
      chatId,
      [
        "Assalomu alaykum! Book.uz botiga xush kelibsiz.",
        "",
        "Kerakli bo‘limni tanlang:",
      ].join("\n"),
      {
        reply_markup: {
          keyboard: [
            [
              {
                text: "💰 Cashback",
                web_app: {
                  url: webAppUrl,
                },
              },
            ],
            [
              {
                text: "📱 Telefon raqamimni yuborish",
                request_contact: true,
              },
            ],
          ],
          resize_keyboard: true,
          is_persistent: true,
        },
      },
    );
  });

  bot.onText(/^\/start(?:@\w+)?$/, async (msg) => {
    await bot.sendMessage(
      msg.chat.id,
      "Tilni tanlang / Выберите язык:",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🇺🇿 O'zbekcha",
                callback_data: "language:uz",
              },
              {
                text: "🇷🇺 Русский",
                callback_data: "language:ru",
              },
            ],
          ],
        },
      },
    );
  });

  bot.on("callback_query", async (query) => {
    const match = String(query.data || "").match(/^language:(uz|ru)$/);
    if (!match) return;

    const language = match[1];
    const telegramId = String(query.from.id);
    const chatId = query.message?.chat?.id;

    try {
      const user = await User.findOne({ telegramId });

      if (user) {
        user.preferences = user.preferences || {};
        user.preferences.language = language;
        await user.save();
        await TelegramBotPreference.deleteOne({ telegramId });
      } else {
        await TelegramBotPreference.findOneAndUpdate(
          { telegramId },
          { $set: { language } },
          { upsert: true, returnDocument: "after" },
        );
      }

      await bot.answerCallbackQuery(query.id, {
        text: t(language, "languageSaved"),
      });

      if (chatId) {
        await sendMainMenu(bot, chatId, language);
      }
    } catch (error) {
      console.error("Telegram tilini saqlash xatosi:", error.message);
      await bot.answerCallbackQuery(query.id, {
        text: "Tilni saqlab bo'lmadi / Не удалось сохранить язык",
        show_alert: true,
      });
    }
  });

  bot.onText(/^\/help(?:@\w+)?$/, async (msg) => {
    try {
      const telegramId = String(msg.from.id);
      const user = await User.findOne({ telegramId });
      const language = await getUserLanguage(telegramId, user);
      await sendMainMenu(bot, msg.chat.id, language);
    } catch (error) {
      console.error("Telegram yordam menyusi xatosi:", error.message);
    }
  });

  bot.on("message", async (msg) => {
    const hrChatId = String(
      process.env.TELEGRAM_HR_CHAT_ID || "8024048570",
    ).trim();
    const messageText = msg.text?.trim();

    if (
      !hrChatId ||
      !messageText ||
      messageText.startsWith("/") ||
      msg.chat?.type !== "private" ||
      String(msg.chat.id) === hrChatId
    ) {
      return;
    }

    let user = null;
    try {
      user = await User.findOne({ telegramId: String(msg.from.id) })
        .select("name phone telegramUsername")
        .lean();
    } catch (error) {
      console.error(
        "HR xabari uchun foydalanuvchini topishda xatolik:",
        error.message,
      );
    }

    try {
      await bot.sendMessage(
        hrChatId,
        buildHrNotificationMessage(msg, user),
        {
          parse_mode: "HTML",
          disable_web_page_preview: true,
        },
      );
    } catch (error) {
      console.error(
        "HR chatiga Telegram murojaatini yuborishda xatolik:",
        getTelegramErrorMessage(error),
      );
    }
  });

  bot.onText(/^\/aboutme(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from.id);
    let loadingMessage;
    let language = "uz";

    try {
      const user = await User.findOne({ telegramId });
      language = await getUserLanguage(telegramId, user);

      if (!user?.phone) {
        await bot.sendMessage(
          chatId,
          t(language, "needPhonePurchases"),
          {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: t(language, "phoneButton"),
                    request_contact: true,
                  },
                ],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          },
        );
        return;
      }

      loadingMessage = await bot.sendMessage(
        chatId,
        t(language, "checkingPurchases"),
      );

      const [websiteResult, moyskladResult] = await Promise.allSettled([
        getWebsitePurchases(user),
        getMoyskladPurchases(user.phone),
      ]);

      if (websiteResult.status === "rejected") {
        console.error("Sayt xaridlari xatosi:", websiteResult.reason?.message);
      }
      if (moyskladResult.status === "rejected") {
        console.error(
          "MoySklad xaridlari xatosi:",
          moyskladResult.reason?.message,
        );
      }

      await bot.sendMessage(
        chatId,
        buildLocalizedAboutMeMessage({
          user,
          language,
          website:
            websiteResult.status === "fulfilled" ? websiteResult.value : null,
          moysklad:
            moyskladResult.status === "fulfilled" ? moyskladResult.value : null,
        }),
      );
    } catch (error) {
      console.error("About me komandasi xatosi:", error.message);
      await bot.sendMessage(
        chatId,
        t(language, "purchasesTemporaryError"),
      );
    } finally {
      if (loadingMessage?.message_id) {
        await bot
          .deleteMessage(chatId, loadingMessage.message_id)
          .catch((error) => {
            console.error(
              "Tekshirilmoqda xabarini o'chirishda xatolik:",
              getTelegramErrorMessage(error),
            );
          });
      }
    }
  });

  bot.on("polling_error", (error) => {
    const message = getTelegramErrorMessage(error);
    const statusCode =
      error?.response?.statusCode || error?.response?.body?.error_code;
    const isConflict = statusCode === 409 || message.includes("Conflict:");

    if (isConflict) {
      if (isStoppingPolling) return;

      isStoppingPolling = true;
      console.error(
        "Telegram polling to'xtatildi: shu bot tokeni bilan boshqa instance ishlayapti.",
      );
      bot.stopPolling({ cancel: true }).catch((stopError) => {
        console.error(
          "Telegram pollingni to'xtatish xatosi:",
          getTelegramErrorMessage(stopError),
        );
      });
      return;
    }

    console.error("Telegram polling xatosi:", message);
  });

  bot.on("contact", async (msg) => {
    const contact = msg.contact;
    const chatId = msg.chat.id;
    const telegramId = String(msg.from.id);
    let loadingMessage;
    let phoneLinked = false;
    let language = "uz";

    try {
      language = await getUserLanguage(telegramId);
    } catch (error) {
      console.error("Telegram tilini olish xatosi:", error.message);
    }

    if (!contact?.user_id || String(contact.user_id) !== String(msg.from.id)) {
      await bot
        .sendMessage(chatId, t(language, "ownContactOnly"))
        .catch((error) => {
          console.error(
            "Telegram xabar yuborish xatosi:",
            getTelegramErrorMessage(error),
          );
        });

      return;
    }

    try {
      const formattedPhone = formatUzPhone(contact.phone_number);
      if (!isValidPhone(formattedPhone)) {
        throw new Error("Telefon raqami noto'g'ri");
      }

      loadingMessage = await bot.sendMessage(
        chatId,
        t(language, "linkingPhone"),
      );

      const phoneVariants = buildPhoneVariants(formattedPhone);

      const [telegramUser, phoneUser] = await Promise.all([
        User.findOne({ telegramId }),
        User.findOne({ phone: { $in: phoneVariants } }),
      ]);

      if (
        telegramUser &&
        phoneUser &&
        telegramUser._id.toString() !== phoneUser._id.toString()
      ) {
        throw new Error(
          "Telegram va telefon boshqa profillarga bog'langan. Administratorga murojaat qiling",
        );
      }

      if (phoneUser?.telegramId && phoneUser.telegramId !== telegramId) {
        throw new Error(
          "Bu telefon raqami boshqa Telegram akkauntiga bog'langan. Administratorga murojaat qiling",
        );
      }

      if (
        telegramUser?.phone &&
        normalizePhone(telegramUser.phone) !== normalizePhone(formattedPhone)
      ) {
        throw new Error(
          "Telegram akkauntingiz boshqa telefon raqamiga bog'langan. Administratorga murojaat qiling",
        );
      }

      const telegramName = [msg.from.first_name, msg.from.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

      const user =
        telegramUser ||
        phoneUser ||
        new User({
          name: telegramName || "Telegram foydalanuvchi",
          phone: formattedPhone,
          authProvider: "telegram",
          profileCompleted: false,
        });

      language = await getUserLanguage(telegramId, user);

      user.telegramId = telegramId;
      user.telegramChatId = String(chatId);
      user.telegramUsername = msg.from.username ? `@${msg.from.username}` : "";
      user.phone = formattedPhone;
      user.phoneVerified = true;
      user.isVerified = true;
      user.preferences = user.preferences || {};
      user.preferences.language = language;

      await user.save();
      await TelegramBotPreference.deleteOne({ telegramId });
      phoneLinked = true;

      await bot.editMessageText(t(language, "checkingCashback"), {
        chat_id: chatId,
        message_id: loadingMessage.message_id,
      });

      const customer = await getCashbackByPhone(formattedPhone);

      const bonus = formatLocalizedPoints(customer.bonusPoints, language);

      await bot.sendMessage(
        chatId,
        [
          t(language, "balanceTitle"),
          "",
          `${t(language, "customerLabel")}: ${customer.name}`,
          `${t(language, "bonusLabel")}: ${bonus}`,
        ].join("\n"),
        {
          reply_markup: {
            remove_keyboard: true,
          },
        },
      );
    } catch (error) {
      logCashbackError("Cashback qidirish xatosi:", error);

      const message = localizeKnownError(
        error.message,
        language,
        phoneLinked ? "linkedCashbackError" : "cashbackTemporaryError",
      );

      await bot.sendMessage(chatId, message).catch((sendError) => {
        console.error(
          "Telegram xabar yuborish xatosi:",
          getTelegramErrorMessage(sendError),
        );
      });
    } finally {
      if (loadingMessage?.message_id) {
        await bot
          .deleteMessage(chatId, loadingMessage.message_id)
          .catch((error) => {
            console.error(
              "Cashback loading xabarini o'chirishda xatolik:",
              getTelegramErrorMessage(error),
            );
          });
      }
    }
  });

  console.log("Telegram bot ishga tushdi");

  return bot;
};

const sendTelegramOTP = async (chatId, otp) => {
  try {
    const telegramBot = bot || initTelegramBot();
    const user = await User.findOne({ telegramChatId: String(chatId) });
    const language = user
      ? await getUserLanguage(String(user.telegramId || ""), user)
      : "uz";
    const message = [
      "<b>BOOK.UZ SUPPORT</b>",
      "",
      `<b>${t(language, "otpTitle")}</b>`,
      t(language, "otpCode"),
      "",
      `<code>${String(otp)}</code>`,
      "",
      t(language, "otpExpires"),
    ].join("\n");

    await telegramBot.sendMessage(chatId, message, { parse_mode: "HTML" });
    return true;
  } catch (error) {
    console.error(
      "Telegramga OTP yuborishda xatolik:",
      getTelegramErrorMessage(error),
    );
    return false;
  }
};

module.exports = {
  initTelegramBot,
  buildAboutMeMessage,
  buildLocalizedAboutMeMessage,
  buildHrNotificationMessage,
  sendTelegramOTP,
};
