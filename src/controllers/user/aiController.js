const OpenAI = require("openai");
const apiResponse = require("../../utils/apiResponse");

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

exports.chat = async (req, res, next) => {
  try {
    const { message } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      return apiResponse(res, 400, false, "Xabar kiritilmadi");
    }

    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      instructions:
        "Siz Book.uz kitob do'konining AI yordamchisisiz. O'zbek tilida qisqa va foydali javob bering.",
      input: message.trim(),
    });

    return apiResponse(res, 200, true, "AI javobi", {
      answer: response.output_text,
    });
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

    next(error);
  }
};
