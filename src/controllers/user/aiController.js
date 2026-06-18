const OpenAI = require("openai");
const apiResponse = require("../../utils/apiResponse");
const { searchBooks } = require("../../services/aiBookSearch.service");

const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY serverda sozlanmagan");
    error.statusCode = 503;
    throw error;
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

const getLocalizedText = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.uz || value.ru || value.en || "";
};

const sanitizeHistory = (history) => {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (item) =>
        ["assistant", "user"].includes(item?.role) &&
        typeof item?.text === "string" &&
        item.text.trim(),
    )
    .slice(-8)
    .map((item) => ({
      role: item.role,
      text: item.text.trim().slice(0, 600),
    }));
};

const buildChatInput = (message, history) => {
  const chatHistory = sanitizeHistory(history);

  if (!chatHistory.length) {
    return message.trim();
  }

  const historyText = chatHistory
    .map((item) => `${item.role === "user" ? "Mijoz" : "AI"}: ${item.text}`)
    .join("\n");

  return `Suhbat tarixi:\n${historyText}\n\nMijozning hozirgi xabari: ${message.trim()}`;
};

const formatBooksAnswer = (books) => {
  if (!books.length) {
    return "Hozircha mos kitob topilmadi. Muallif, janr, til yoki narx bo'yicha biroz aniqroq yozib bera olasizmi?";
  }

  const lines = books.slice(0, 5).map((book, index) => {
    const title = getLocalizedText(book.title) || "Nomsiz kitob";
    const author = book.author?.name ? ` - ${book.author.name}` : "";
    const price = book.discountPrice || book.price;
    const priceText = price
      ? `${Number(price).toLocaleString("uz-UZ")} so'm`
      : "narxi ko'rsatilmagan";
    const stockText =
      Number(book.stock) > 0
        ? `mavjud: ${book.stock} dona`
        : "hozircha mavjud emas";
    const link = book.slug ? `${process.env.CLIENT_URL}/book/${book.slug}` : "";

    return `${index + 1}. ${title}${author} | ${priceText} | ${stockText}${link ? ` | ${link}` : ""}`;
  });

  return `Sizga mos kitoblar:\n\n${lines.join("\n")}\n\nYana aniqroq tavsiya kerak bo'lsa, janr yoki muallif nomini yozing.`;
};

const formatAiBookPayload = (books) =>
  books.slice(0, 8).map((book) => ({
    title: getLocalizedText(book.title) || "Nomsiz kitob",
    author: book.author?.name || "",
    category: getLocalizedText(book.category?.title) || book.category?.name || "",
    price: book.discountPrice || book.price || null,
    stock: Number(book.stock) || 0,
    language: book.language,
    ratingAvg: book.ratingAvg,
    link: book.slug ? `${process.env.CLIENT_URL}/book/${book.slug}` : "",
  }));

const bookSearchTool = {
  type: "function",
  name: "search_books",
  description:
    "Book.uz bazasidan mijoz so'ragan kitoblarni qidiradi. Faqat kitob qidirish va tavsiya qilish uchun ishlatiladi.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Kitob nomi, janr, mavzu, muallif yoki mijoz yozgan qidiruv matni",
      },
      language: {
        type: "string",
        enum: ["uz", "ru", "en"],
        description: "Kitob tili. Faqat mijoz aniq aytsa yuboriladi.",
      },
      minPrice: {
        type: "number",
        description: "Minimal narx",
      },
      maxPrice: {
        type: "number",
        description: "Maksimal narx",
      },
      limit: {
        type: "number",
        description: "Nechta kitob qaytarish kerak. Maksimum 10.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
};

const runToolCall = async (toolCall) => {
  if (toolCall.name !== "search_books") {
    return {
      error: "Unknown tool",
    };
  }

  const args = JSON.parse(toolCall.arguments || "{}");
  const books = await searchBooks(args);

  return {
    books,
    count: books.length,
  };
};

exports.chat = async (req, res, next) => {
  try {
    const { message, history } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      return apiResponse(res, 400, false, "Xabar kiritilmadi");
    }

    const openai = getOpenAIClient();
    const input = buildChatInput(message, history);

    const firstResponse = await openai.responses.create({
      model: "gpt-5-mini",
      instructions: `Siz Book.uz kitob do'konining AI yordamchisisiz.
          Mijoz qaysi tilda yozsa, aynan o'sha tilda javob bering.
          Agar mijoz tili noaniq bo'lsa, o'zbek tilida javob bering.

          Qoidalar:
          - Mijoz kitob bor-yo'qligini so'rasa, kitob nomini yozsa yoki tavsiya so'rasa, albatta search_books tool orqali bazadan qidiring.
          - Kitob tavsiya qilishdan oldin ham search_books tool orqali bazadan qidiring.
          - Faqat tool qaytargan kitoblarni bor deb ayting.
          - Bazada topilmagan kitobni bor deb o'ylab topmang.
          - Agar kitob topilmasa, mijozdan janr, muallif, til yoki narx bo'yicha aniqlashtirish so'rang.
          - Har bir tavsiyada nom, narx, mavjudlik va link ko'rsating.
          - Oldingi suhbat tarixidan foydalaning: mijoz "yana", "shunga o'xshash", "arzonroq" desa, avvalgi mavzuni hisobga oling.
          - Javobni qisqa, foydali va savdo maslahatchisidek yozing.
          - To'lov, parol, token, admin yoki maxfiy ma'lumotlar haqida javob bermang.`.trim(),
      input,
      tools: [bookSearchTool],
    });

    const toolCalls = firstResponse.output.filter(
      (item) => item.type === "function_call",
    );

    if (!toolCalls.length) {
      return apiResponse(res, 200, true, "AI javobi", {
        answer: firstResponse.output_text,
      });
    }

    const books = [];

    for (const toolCall of toolCalls) {
      const result = await runToolCall(toolCall);
      if (Array.isArray(result.books)) {
        books.push(...result.books);
      }
    }

    const uniqueBooks = [
      ...new Map(books.map((book) => [book.id, book])).values(),
    ];

    if (!uniqueBooks.length) {
      return apiResponse(res, 200, true, "AI javobi", {
        answer: formatBooksAnswer([]),
      });
    }

    try {
      const finalResponse = await openai.responses.create({
        model: "gpt-5-mini",
        instructions: `Siz Book.uz do'konining kitob maslahatchisisiz.
          Faqat berilgan JSON ichidagi kitoblarni tavsiya qiling.
          Mijoz yozgan tilda javob bering.
          Javob 5 ta kitobdan oshmasin.
          Har bir kitobda nom, muallif, narx, mavjudlik va link bo'lsin.
          Kitoblar orasidan mijoz so'roviga eng moslarini tanlab, nega mosligini 1 qisqa jumlada ayting.
          Agar variantlar to'liq mos bo'lmasa, oxirida bitta aniqlashtiruvchi savol bering.`.trim(),
        input: `${input}\n\nBook.uz bazasidan topilgan kitoblar JSON:\n${JSON.stringify(
          formatAiBookPayload(uniqueBooks),
        )}`,
      });

      return apiResponse(res, 200, true, "AI javobi", {
        answer: finalResponse.output_text || formatBooksAnswer(uniqueBooks),
      });
    } catch (formatError) {
      console.warn("AI javobini formatlashda xatolik:", formatError.message);

      return apiResponse(res, 200, true, "AI javobi", {
        answer: formatBooksAnswer(uniqueBooks),
      });
    }
  } catch (error) {
    if (error.code === "insufficient_quota") {
      return apiResponse(
        res,
        429,
        false,
        "OpenAI API limiti tugagan. Billing va API kreditini tekshiring.",
      );
    }

    if (error.status === 401) {
      return apiResponse(
        res,
        503,
        false,
        "OpenAI API kaliti noto'g'ri yoki bekor qilingan.",
      );
    }

    if (error.status === 429) {
      return apiResponse(
        res,
        429,
        false,
        "OpenAI so'rovlar limiti oshib ketdi. Birozdan keyin qayta urinib ko'ring.",
      );
    }

    if (error.status === 404) {
      return apiResponse(
        res,
        503,
        false,
        "AI modeli yoki OpenAI endpointi topilmadi. Backenddagi model sozlamasini tekshiring.",
      );
    }

    next(error);
  }
};
