const axios = require("axios");
const cron = require("node-cron");
const Product = require("../models/Product");
const MoyskladTopSales = require("../models/MoyskladTopSales");
const { applyActiveDiscountsToProducts } = require("../utils/productDiscounts");
const {
  getMoyskladBaseUrl,
  moyskladHeaders,
  getAxiosStatus,
  getMoyskladErrorMessage,
  requestWithRetry,
  cleanBarcode,
  getMoyskladBarcode,
  formatMoyskladDate,
} = require("../utils/moyskladClient");

const TOKEN = process.env.MOYSKLAD_API_KEY || process.env.MOYSKLAD_TOKEN;
const TOP_LIMIT = 10;
const REQUEST_LIMIT = 100;
const REQUEST_CONCURRENCY = 3;

let isSyncingTopSales = false;

const MOYSKLAD_BASE_URL = getMoyskladBaseUrl();
const headers = moyskladHeaders(TOKEN);

const getPeriodRange = (period) => {
  const to = new Date();
  const from = new Date(to);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  if (period === "month") {
    from.setDate(to.getDate() - 29);
  } else {
    from.setDate(to.getDate() - 6);
  }

  return { from, to };
};

const fetchAllRows = async (url, params, label) => {
  const fetchPage = (offset) =>
    requestWithRetry(
      () =>
        axios.get(url, {
          headers,
          timeout: 30000,
          params: { ...params, limit: REQUEST_LIMIT, offset },
        }),
      label,
    );

  const firstResponse = await fetchPage(0);
  const firstRows = firstResponse?.data?.rows || [];
  const total = Number(firstResponse?.data?.meta?.size);

  if (!Number.isFinite(total) || total <= firstRows.length) {
    return firstRows;
  }

  const offsets = [];
  for (let offset = REQUEST_LIMIT; offset < total; offset += REQUEST_LIMIT) {
    offsets.push(offset);
  }

  const pages = new Array(offsets.length);
  let nextPageIndex = 0;

  const workers = Array.from(
    { length: Math.min(REQUEST_CONCURRENCY, offsets.length) },
    async () => {
      while (nextPageIndex < offsets.length) {
        const pageIndex = nextPageIndex;
        nextPageIndex += 1;
        const response = await fetchPage(offsets[pageIndex]);
        pages[pageIndex] = response?.data?.rows || [];
      }
    },
  );

  await Promise.all(workers);
  return [firstRows, ...pages].flat();
};

const fetchDemands = ({ from, to }) =>
  fetchAllRows(
    `${MOYSKLAD_BASE_URL}/entity/demand`,
    {
      filter: [
        `moment>=${formatMoyskladDate(from)}`,
        `moment<=${formatMoyskladDate(to, true)}`,
      ].join(";"),
      expand: "positions",
    },
    "MoySklad demand so'rovi",
  );

const fetchDemandPositions = (demandId) =>
  fetchAllRows(
    `${MOYSKLAD_BASE_URL}/entity/demand/${demandId}/positions`,
    {},
    "MoySklad demand positions so'rovi",
  );

const buildLocalProductLookup = async () => {
  const products = await Product.find(
    {
      isActive: true,
      $or: [
        { moyskladId: { $exists: true, $ne: "" } },
        { barcode: { $exists: true, $ne: "" } },
      ],
    },
    "barcode moyskladId",
  ).lean();
  const byBarcode = new Map();
  const byMoyskladId = new Map();

  products.forEach((product) => {
    const barcode = cleanBarcode(product.barcode);
    if (barcode) byBarcode.set(barcode, product._id);
    if (product.moyskladId) {
      byMoyskladId.set(product.moyskladId, product._id);
    }
  });

  return { byBarcode, byMoyskladId };
};

const getAssortmentId = (assortment = {}) => {
  if (assortment.id) return assortment.id;

  const href = assortment.meta?.href;
  if (!href) return "";

  return href.split("/").filter(Boolean).pop() || "";
};

const getDemandPositions = async (demand) => {
  const embeddedRows = demand.positions?.rows;
  const total = Number(demand.positions?.meta?.size);

  if (
    Array.isArray(embeddedRows) &&
    (!Number.isFinite(total) || embeddedRows.length >= total)
  ) {
    return embeddedRows;
  }

  return fetchDemandPositions(demand.id);
};

const calculateTopSalesPeriods = async (periods) => {
  if (!TOKEN) {
    throw new Error(
      "MOYSKLAD_API_KEY yoki MOYSKLAD_TOKEN .env faylida topilmadi",
    );
  }

  const ranges = Object.fromEntries(
    periods.map((period) => [period, getPeriodRange(period)]),
  );
  const fetchPeriod = periods.includes("month") ? "month" : "week";
  const { from, to } = ranges[fetchPeriod];
  const localProducts = await buildLocalProductLookup();
  const demands = await fetchDemands({ from, to });
  const salesByPeriod = Object.fromEntries(
    periods.map((period) => [period, new Map()]),
  );

  for (const demand of demands) {
    const positions = await getDemandPositions(demand);
    const demandMoment = new Date(String(demand.moment).replace(" ", "T"));

    for (const position of positions) {
      const assortment = position.assortment || {};
      const moyskladId = getAssortmentId(assortment);
      const barcode = getMoyskladBarcode(assortment);
      const productId =
        localProducts.byMoyskladId.get(moyskladId) ||
        localProducts.byBarcode.get(barcode);

      if (!productId) continue;

      for (const period of periods) {
        if (demandMoment < ranges[period].from) continue;

        const salesByProduct = salesByPeriod[period];
        const key = productId.toString();
        const current = salesByProduct.get(key) || {
          product: productId,
          barcode,
          soldQuantity: 0,
        };

        current.soldQuantity += Number(position.quantity || 0);
        salesByProduct.set(key, current);
      }
    }
  }

  const syncedAt = new Date();
  return periods.map((period) => ({
    period,
    ...ranges[period],
    products: [...salesByPeriod[period].values()]
      .sort((a, b) => b.soldQuantity - a.soldQuantity)
      .slice(0, TOP_LIMIT),
    syncedAt,
  }));
};

const saveTopSales = async (data) => {
  await Promise.all(
    data.map((periodData) =>
      MoyskladTopSales.findOneAndUpdate(
        { period: periodData.period },
        { $set: periodData },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      ),
    ),
  );

  data.forEach((periodData) => {
    console.log(
      `MoySklad ${periodData.period} top sales sync: ${periodData.products.length} ta kitob`,
    );
  });

  return data;
};

const syncTopSalesPeriod = async (period) =>
  saveTopSales(await calculateTopSalesPeriods([period]));

const syncMoyskladTopSales = async () => {
  if (isSyncingTopSales) {
    console.log("MoySklad top-sales sinxronizatsiyasi hali davom etmoqda");
    return;
  }

  isSyncingTopSales = true;

  try {
    await saveTopSales(await calculateTopSalesPeriods(["week", "month"]));
  } catch (error) {
    const status = getAxiosStatus(error);
    const message = getMoyskladErrorMessage(error);
    console.error(
      `MoySklad top-sales sync xatosi: ${status || "NO_STATUS"} - ${message}`,
    );
  } finally {
    isSyncingTopSales = false;
  }
};

const runScheduledTopSalesPeriod = async (period) => {
  try {
    await syncTopSalesPeriod(period);
  } catch (error) {
    const status = getAxiosStatus(error);
    const message = getMoyskladErrorMessage(error);
    console.error(
      `MoySklad ${period} top-sales cron xatosi: ${status || "NO_STATUS"} - ${message}`,
    );
  }
};

const startTopSalesCron = () => {
  setTimeout(syncMoyskladTopSales, 10000);

  cron.schedule("0 3 * * 1", () => runScheduledTopSalesPeriod("week"));
  cron.schedule("30 3 1 * *", () => runScheduledTopSalesPeriod("month"));

  console.log(
    "MoySklad top-sales sinxronizatsiyasi: hafta dushanba 03:00, oy 1-kuni 03:30",
  );
};

const getCachedTopSales = async (period = "week") => {
  const cache = await MoyskladTopSales.findOne({ period })
    .populate({
      path: "products.product",
      match: { isActive: true },
    })
    .lean();

  if (!cache) return null;

  const products = cache.products
    .filter((item) => item.product)
    .map((item) => ({
      ...item.product,
      barcode: item.barcode || item.product.barcode,
      soldQuantity: item.soldQuantity,
    }));

  return {
    ...cache,
    products: await applyActiveDiscountsToProducts(products),
  };
};

module.exports = {
  getCachedTopSales,
  syncMoyskladTopSales,
  startTopSalesCron,
};
