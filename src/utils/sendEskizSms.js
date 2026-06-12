const axios = require("axios");

const ESKIZ_API_URL =
  process.env.ESKIZ_API_URL || "https://notify.eskiz.uz/api";
const ESKIZ_FROM = process.env.ESKIZ_FROM || "4546";

let cachedToken = null;

const normalizeEskizPhone = (phone) => {
  return String(phone || "").replace(/^\+/, "");
};

const createEskizError = (message, statusCode = 502, cause) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.cause = cause;
  return error;
};

const getEskizErrorMessage = (error) => {
  const responseData = error.response?.data;

  if (typeof responseData?.message === "string") {
    return responseData.message;
  }

  if (responseData?.message?.mobile_phone) {
    return `Telefon raqam formati Eskiz tomonidan rad etildi: ${responseData.message.mobile_phone.join(", ")}`;
  }

  if (typeof responseData === "string") {
    return responseData;
  }

  return error.message;
};

const getEskizToken = async () => {
  if (cachedToken) {
    return cachedToken;
  }

  if (!process.env.ESKIZ_EMAIL || !process.env.ESKIZ_PASSWORD) {
    throw createEskizError("Eskiz SMS sozlamalari topilmadi", 500);
  }

  let data;
  try {
    const response = await axios.post(`${ESKIZ_API_URL}/auth/login`, {
      email: process.env.ESKIZ_EMAIL,
      password: process.env.ESKIZ_PASSWORD,
    });
    data = response.data;
  } catch (error) {
    const status = error.response?.status;
    const providerMessage = getEskizErrorMessage(error);
    const message =
      status === 401 || providerMessage === "invalid_credentials"
        ? "Eskiz login yoki secret key noto'g'ri"
        : `Eskiz token olishda xatolik: ${providerMessage}`;

    throw createEskizError(message, 502, error);
  }

  cachedToken = data?.data?.token || data?.token;

  if (!cachedToken) {
    throw createEskizError("Eskiz token olishda xatolik", 502);
  }

  return cachedToken;
};

const refreshEskizToken = async () => {
  const token = await getEskizToken();

  try {
    const response = await axios.patch(`${ESKIZ_API_URL}/auth/refresh`, null, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    cachedToken = response.data?.data?.token || response.data?.token;
    if (!cachedToken) {
      throw createEskizError("Eskiz token yangilashda xatolik", 502);
    }

    return cachedToken;
  } catch (error) {
    cachedToken = null;
    throw createEskizError(
      `Eskiz token yangilashda xatolik: ${getEskizErrorMessage(error)}`,
      502,
      error,
    );
  }
};

const createSmsFormData = (phone, message) => {
  const formData = new FormData();

  formData.append("mobile_phone", normalizeEskizPhone(phone));
  formData.append("message", message);
  formData.append("from", ESKIZ_FROM);

  if (process.env.ESKIZ_CALLBACK_URL) {
    formData.append("callback_url", process.env.ESKIZ_CALLBACK_URL);
  }

  return formData;
};

const postEskizSms = async (token, phone, message) => {
  const { data } = await axios.post(
    `${ESKIZ_API_URL}/message/sms/send`,
    createSmsFormData(phone, message),
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return data;
};

const getEskizTemplates = async () => {
  const token = await getEskizToken();

  try {
    const { data } = await axios.get(`${ESKIZ_API_URL}/user/templates`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return data;
  } catch (error) {
    if (error.response?.status === 401) {
      const refreshedToken = await refreshEskizToken();
      const { data } = await axios.get(`${ESKIZ_API_URL}/user/templates`, {
        headers: {
          Authorization: `Bearer ${refreshedToken}`,
        },
      });

      return data;
    }

    throw createEskizError(
      `Eskiz template ro'yxatini olishda xatolik: ${getEskizErrorMessage(error)}`,
      error.response?.status === 400 ? 400 : 502,
      error,
    );
  }
};

const sendEskizSms = async (phone, message) => {
  const token = await getEskizToken();

  try {
    return await postEskizSms(token, phone, message);
  } catch (error) {
    if (error.response?.status === 401) {
      const refreshedToken = await refreshEskizToken();
      return postEskizSms(refreshedToken, phone, message);
    }

    throw createEskizError(
      `Eskiz SMS yuborishda xatolik: ${getEskizErrorMessage(error)}`,
      error.response?.status === 400 ? 400 : 502,
      error,
    );
  }
};

sendEskizSms.getTemplates = getEskizTemplates;

module.exports = sendEskizSms;
