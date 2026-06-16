const axios = require("axios");
const cron = require("node-cron");
const Product = require("../models/Product");
const MoyskladTopSales = require("../models/MoyskladTopSales");

const MOYSKLAD_API_URL = process.env.MOYSKLAD_API_URL;
const TOKEN = process.env.MOYSKLAD_API_KEY || process.env.MOYSKLAD_TOKEN;
const TOP_LIMIT = 10;
const REQUEST_LIMIT = 100;
const RETRY_DELAYS_MS = [5000, 15000, 30000];
const SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

let isSyncingTopSales = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getMoyskladBaseUrl = () => {
  if (!MOYSKLAD_API_URL) return "https://api.moysklad.ru/api/remap/1.2";

  const marker = "/api/remap/1.2";
  const markerIndex = MOYSKLAD_API_URL.indexOf(marker);

  if (markerIndex === -1) {
    return MOYSKLAD_API_URL.replace(/\/entity\/.*$/, "");
  }

  return MOYSKLAD_API_URL.slice(0, markerIndex + marker.length);
};

const MOYSKLAD_BASE_URL = getMoyskladBaseUrl();

const moyskladHeaders = () => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/json;charset=utf-8",
  "Cache-Control": "no-cache",
});

const getAxiosStatus = (error) => error.response?.status;

const requestWithRetry = async (requestFn, label) => {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await requestFn();
    } catch (error) {
      const canRetry = getAxiosStatus(error) === 429 && attempt < RETRY_DELAYS_MS.length;
      if (!canRetry) throw error;

      const waitMs = RETRY_DELAYS_MS[attempt];
      console.warn(`${label}: MoySklad limitiga urildi, ${Math.round(waitMs / 1000)} sekund kutamiz...`);
      await delay(waitMs);
    }
  }

  return null;
};

const cleanBarcode = (barcode) => barcode?.toString().replace(/\D/g, "") || "";

const getMoyskladBarcode = (assortment = {}) => {
  const barcodes = assortment.barcodes || [];

  for (const barcode of barcodes) {
    const value = barcode.ean13 || barcode.ean8 || barcode.code128 || barcode.gtin || Object.values(barcode)[0];
    if (value) return cleanBarcode(value);
  }

  return cleanBarcode(assortment.barcode || assortment.code || assortment.article);
};

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

const formatMoyskladDate = (date, endOfDay = false) => {
  const pad = (value) => String(value).padStart(2, "0");
  const hours = endOfDay ? "23:59:59" : "00:00:00";

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hours}`;
};

const fetchAllRows = async (url, params, label) => {
  const rows = [];
  let offset = 0;

  while (true) {
    const response = await requestWithRetry(
      () =>
        axios.get(url, {
          headers: moyskladHeaders(),
          timeout: 30000,
          params: { ...params, limit: REQUEST_LIMIT, offset },
        }),
      label,
    );

    const chunk = response?.data?.rows || [];
    rows.push(...chunk);

    if (chunk.length < REQUEST_LIMIT) break;
    offset += REQUEST_LIMIT;
  }

  return rows;
};

const fetchDemands = ({ from, to }) =>
  fetchAllRows(
    `${MOYSKLAD_BASE_URL}/entity/demand`,
    {
      filter: [`moment>=${formatMoyskladDate(from)}`, `moment<=${formatMoyskladDate(to, true)}`].join(";"),
      expand: "positions.assortment",
    },
    "MoySklad demand so'rovi",
  );

const fetchDemandPositions = (demandId) =>
  fetchAllRows(
    `${MOYSKLAD_BASE_URL}/entity/demand/${demandId}/positions`,
    { expand: "assortment" },
    "MoySklad demand positions so'rovi",
  );

const buildLocalProductLookup = async () => {
  const products = await Product.find({ barcode: { $exists: true, $ne: "" } }, "barcode").lean();
  const lookup = new Map();

  products.forEach((product) => {
    const barcode = cleanBarcode(product.barcode);
    if (barcode) lookup.set(barcode, product._id);
  });

  return lookup;
};

const calculateTopSales = async (period) => {
  if (!TOKEN) {
    throw new Error("MOYSKLAD_API_KEY yoki MOYSKLAD_TOKEN .env faylida topilmadi");
  }

  const { from, to } = getPeriodRange(period);
  const localProductsByBarcode = await buildLocalProductLookup();
  const demands = await fetchDemands({ from, to });
  const salesByProduct = new Map();

  for (const demand of demands) {
    const positions = demand.positions?.rows || (await fetchDemandPositions(demand.id));

    for (const position of positions) {
      const barcode = getMoyskladBarcode(position.assortment || {});
      if (!barcode) continue;

      const productId = localProductsByBarcode.get(barcode);
      if (!productId) continue;

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

  const products = [...salesByProduct.values()]
    .sort((a, b) => b.soldQuantity - a.soldQuantity)
    .slice(0, TOP_LIMIT);

  return { period, from, to, products, syncedAt: new Date() };
};

const syncTopSalesPeriod = async (period) => {
  const data = await calculateTopSales(period);

  await MoyskladTopSales.findOneAndUpdate(
    { period },
    { $set: data },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  console.log(`MoySklad ${period} top sales sync: ${data.products.length} ta kitob`);
  return data;
};

const syncMoyskladTopSales = async () => {
  if (isSyncingTopSales) {
    console.log("MoySklad top-sales sinxronizatsiyasi hali davom etmoqda");
    return;
  }

  isSyncingTopSales = true;

  try {
    await syncTopSalesPeriod("week");
    await syncTopSalesPeriod("month");
  } catch (error) {
    const status = getAxiosStatus(error);
    const message = error.response?.data?.errors?.[0]?.error || error.message;
    console.error(`MoySklad top-sales sync xatosi: ${status || "NO_STATUS"} - ${message}`);
  } finally {
    isSyncingTopSales = false;
  }
};

const runScheduledTopSalesPeriod = async (period) => {
  try {
    await syncTopSalesPeriod(period);
  } catch (error) {
    const status = getAxiosStatus(error);
    const message = error.response?.data?.errors?.[0]?.error || error.message;
    console.error(`MoySklad ${period} top-sales cron xatosi: ${status || "NO_STATUS"} - ${message}`);
  }
};

const startTopSalesCron = () => {
  setTimeout(syncMoyskladTopSales, 10000);

  cron.schedule("0 3 * * 1", () => runScheduledTopSalesPeriod("week"));
  cron.schedule("30 3 1 * *", () => runScheduledTopSalesPeriod("month"));

  console.log("MoySklad top-sales sinxronizatsiyasi: hafta dushanba 03:00, oy 1-kuni 03:30");
};

const getCachedTopSales = async (period = "week") => {
  const cache = await MoyskladTopSales.findOne({ period })
    .populate("products.product")
    .lean();

  if (!cache) return null;

  return {
    ...cache,
    products: cache.products
      .filter((item) => item.product)
      .map((item) => ({
        ...item.product,
        barcode: item.barcode || item.product.barcode,
        soldQuantity: item.soldQuantity,
      })),
  };
};

module.exports = {
  getCachedTopSales,
  syncMoyskladTopSales,
  startTopSalesCron,
};