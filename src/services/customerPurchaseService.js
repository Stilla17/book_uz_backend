const axios = require("axios");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { formatUzPhone, normalizePhone } = require("../utils/phone");
const {
  getMoyskladBaseUrl,
  moyskladHeaders,
  requestWithRetry,
} = require("../utils/moyskladClient");
const { getCashbackByPhone } = require("./moyskladCashbackService");

const PAGE_SIZE = 100;
const MOYSKLAD_BASE_URL = getMoyskladBaseUrl();

const getMoyskladHeaders = () =>
  moyskladHeaders(
    process.env.MOYSKLAD_API_KEY || process.env.MOYSKLAD_TOKEN,
  );

const getTitle = (title) => {
  if (typeof title === "string") return title;
  return title?.uz || title?.ru || title?.en || "Noma'lum kitob";
};

const addPurchase = (purchases, key, name, quantity) => {
  const normalizedQuantity = Number(quantity || 0);
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) return;

  const current = purchases.get(key) || { name, quantity: 0 };
  current.quantity += normalizedQuantity;
  purchases.set(key, current);
};

const buildPhoneVariants = (phone) => {
  const formattedPhone = formatUzPhone(phone);
  const digits = normalizePhone(formattedPhone);
  const localPhone = digits.startsWith("998") ? digits.slice(3) : digits;

  return [
    phone,
    formattedPhone,
    digits,
    localPhone,
    digits ? `+${digits}` : "",
    localPhone ? `+998${localPhone}` : "",
  ].filter(Boolean);
};

const getWebsitePurchases = async (user) => {
  const ownerFilters = [{ user: user._id }];
  const phoneVariants = buildPhoneVariants(user.phone);

  if (phoneVariants.length) {
    ownerFilters.push({ "shippingAddress.phone": { $in: phoneVariants } });
  }

  const orders = await Order.find({
    $and: [
      { $or: ownerFilters },
      {
        $or: [{ paymentStatus: "PAID" }, { status: "DELIVERED" }],
      },
      { status: { $ne: "CANCELLED" } },
    ],
  })
    .sort({ createdAt: -1 })
    .populate("items.product", "title")
    .lean();

  const purchases = new Map();
  let totalAmount = 0;

  orders.forEach((order) => {
    totalAmount += Number(order.totalAmount || 0);

    (order.items || []).forEach((item) => {
      const product = item.product;
      const key = product?._id?.toString() || getTitle(product?.title);
      addPurchase(
        purchases,
        key,
        getTitle(product?.title),
        item.quantity,
      );
    });
  });

  return {
    ordersCount: orders.length,
    totalAmount,
    books: [...purchases.values()].sort(
      (first, second) => second.quantity - first.quantity,
    ),
  };
};

const fetchDemandPositions = async (demand) => {
  const embeddedRows = demand.positions?.rows;
  const total = Number(demand.positions?.meta?.size);

  if (
    Array.isArray(embeddedRows) &&
    (!Number.isFinite(total) || embeddedRows.length >= total)
  ) {
    return embeddedRows;
  }

  const response = await requestWithRetry(
    () =>
      axios.get(`${MOYSKLAD_BASE_URL}/entity/demand/${demand.id}/positions`, {
        headers: getMoyskladHeaders(),
        timeout: 30000,
        params: { limit: 1000, expand: "assortment" },
      }),
    "MoySklad sotuv pozitsiyalari so'rovi",
  );

  return response?.data?.rows || [];
};

const fetchCustomerDemands = async (moyskladId) => {
  const rows = [];
  let offset = 0;
  let total = 0;

  do {
    const response = await requestWithRetry(
      () =>
        axios.get(`${MOYSKLAD_BASE_URL}/entity/demand`, {
          headers: getMoyskladHeaders(),
          timeout: 30000,
          params: {
            limit: PAGE_SIZE,
            offset,
            order: "moment,desc",
            expand: "positions.assortment",
            filter: `agent=${MOYSKLAD_BASE_URL}/entity/counterparty/${moyskladId}`,
          },
        }),
      "MoySklad mijoz sotuvlari so'rovi",
    );

    const pageRows = response?.data?.rows || [];
    total = Number(response?.data?.meta?.size || pageRows.length);
    rows.push(...pageRows);
    offset += pageRows.length;

    if (!pageRows.length) break;
  } while (offset < total);

  return rows;
};

const getMoyskladPurchases = async (phone) => {
  if (!process.env.MOYSKLAD_API_KEY && !process.env.MOYSKLAD_TOKEN) {
    throw new Error("MoySklad API kaliti sozlanmagan");
  }

  const customer = await getCashbackByPhone(phone);
  const demands = await fetchCustomerDemands(customer.moyskladId);
  const purchases = new Map();
  const demandPositions = [];

  for (const demand of demands) {
    const positions = await fetchDemandPositions(demand);
    demandPositions.push(...positions);
  }

  const assortmentIds = [
    ...new Set(
      demandPositions
        .map((position) => {
          const assortment = position.assortment || {};
          return (
            assortment.id ||
            assortment.meta?.href?.split("/").filter(Boolean).pop()
          );
        })
        .filter(Boolean),
    ),
  ];
  const localProducts = await Product.find(
    { moyskladId: { $in: assortmentIds } },
    "moyskladId title",
  ).lean();
  const localProductNames = new Map(
    localProducts.map((product) => [
      product.moyskladId,
      getTitle(product.title),
    ]),
  );

  demandPositions.forEach((position) => {
    const assortment = position.assortment || {};
    const assortmentId =
      assortment.id ||
      assortment.meta?.href?.split("/").filter(Boolean).pop();
    const name =
      localProductNames.get(assortmentId) ||
      assortment.name ||
      "Noma'lum kitob";

    addPurchase(purchases, assortmentId || name, name, position.quantity);
  });

  return {
    customerName: customer.name,
    salesCount: demands.length,
    totalAmount:
      demands.reduce((sum, demand) => sum + Number(demand.sum || 0), 0) / 100,
    books: [...purchases.values()].sort(
      (first, second) => second.quantity - first.quantity,
    ),
  };
};

module.exports = {
  getWebsitePurchases,
  getMoyskladPurchases,
};
