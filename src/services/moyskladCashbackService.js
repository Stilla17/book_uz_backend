const axios = require("axios");
const {
  getMoyskladBaseUrl,
  moyskladHeaders,
  requestWithRetry,
} = require("../utils/moyskladClient");
const { formatUzPhone, normalizePhone } = require("../utils/phone");

const baseUrl = getMoyskladBaseUrl();

const fetchCustomers = (token, params) =>
  requestWithRetry(
    () =>
      axios.get(`${baseUrl}/entity/counterparty`, {
        headers: moyskladHeaders(token),
        timeout: 30000,
        params: {
          ...params,
          limit: 100,
        },
      }),
    "MoySklad mijoz qidiruvi",
  );

const getCashbackByPhone = async (phone) => {
  const formattedPhone = formatUzPhone(phone);
  const normalizedPhone = normalizePhone(formattedPhone);
  const localPhone = normalizedPhone.slice(-9);

  if (!normalizedPhone) {
    throw new Error("Telefon raqami noto'g'ri");
  }

  const token = process.env.MOYSKLAD_API_KEY || process.env.MOYSKLAD_TOKEN;
  if (!token) {
    throw new Error("MoySklad API kaliti sozlanmagan");
  }

  // MoySklad telefonni erkin formatda saqlaydi. Avval rasmiy aniq telefon
  // filtridan foydalanamiz; eski yoki formatlangan yozuvlar uchun umumiy
  // qidiruv fallback bo'lib qoladi.
  let response = await fetchCustomers(token, {
    filter: `phone=${localPhone}`,
  });

  if (!response?.data?.rows?.length) {
    response = await fetchCustomers(token, { search: localPhone });
  }

  const customers = response?.data?.rows || [];

  const matches = customers.filter(
    (customer) => normalizePhone(customer.phone) === normalizedPhone,
  );

  if (matches.length === 0) {
    throw new Error("Bu telefon raqami MoySklad'da topilmadi");
  }

  if (matches.length > 1) {
    throw new Error(
      "Bu telefon raqamiga bir nechta mijoz bog'langan. Administratorga murojaat qiling",
    );
  }

  const customer = matches[0];

  return {
    moyskladId: customer.id,
    name: customer.name || "Mijoz",
    phone: formattedPhone,
    bonusPoints: Number(customer.bonusPoints || 0),
  };
};

module.exports = {
  getCashbackByPhone,
};
