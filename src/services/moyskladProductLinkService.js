const axios = require("axios");
const Product = require("../models/Product");
const {
  getMoyskladBaseUrl,
  moyskladHeaders,
  requestWithRetry,
  cleanBarcode,
} = require("../utils/moyskladClient");

const TOKEN = process.env.MOYSKLAD_API_KEY;
const MOYSKLAD_BASE_URL = getMoyskladBaseUrl();
const MOYSKLAD_PRODUCT_URL = `${MOYSKLAD_BASE_URL}/entity/product`;
const MOYSKLAD_ASSORTMENT_URL = `${MOYSKLAD_BASE_URL}/entity/assortment`;
const headers = moyskladHeaders(TOKEN);

const linkingByProductId = new Map();

const getPrimaryMoyskladBarcode = (assortment = {}) => {
  const firstBarcode = assortment.barcodes?.[0];
  if (!firstBarcode) return "";

  const value =
    firstBarcode.ean13 ||
    firstBarcode.ean8 ||
    firstBarcode.code128 ||
    firstBarcode.gtin ||
    Object.values(firstBarcode)[0];

  return cleanBarcode(value);
};

const findByExternalCode = async (bookuzId) => {
  const response = await requestWithRetry(
    () =>
      axios.get(MOYSKLAD_PRODUCT_URL, {
        headers,
        timeout: 30000,
        params: { filter: `externalCode=${bookuzId}`, limit: 2 },
      }),
    `MoySklad externalCode qidiruvi (${bookuzId})`,
  );
  const rows = response?.data?.rows || [];

  if (rows.length > 1) {
    throw new Error(
      `MoySklad'da ${bookuzId} externalCode bilan bir nechta mahsulot topildi`,
    );
  }

  return rows[0] || null;
};

const findByCode = async (code) => {
  const normalizedCode = code?.toString().trim();
  if (!normalizedCode) return null;

  const response = await requestWithRetry(
    () =>
      axios.get(MOYSKLAD_PRODUCT_URL, {
        headers,
        timeout: 30000,
        params: { filter: `code=${normalizedCode}`, limit: 2 },
      }),
    `MoySklad code qidiruvi (${normalizedCode})`,
  );
  const rows = response?.data?.rows || [];

  if (rows.length > 1) {
    throw new Error(
      `MoySklad'da ${normalizedCode} code bilan bir nechta mahsulot topildi`,
    );
  }

  return rows[0] || null;
};

const getCoverKeywords = (cover) => {
  if (cover === "hardcover") {
    return ["qattiq", "қаттиқ", "тверд", "hardcover"];
  }

  if (cover === "softcover" || cover === "paperback") {
    return [
      "yumshoq",
      "юмшоқ",
      "юмшок",
      "мягк",
      "softcover",
      "paperback",
    ];
  }

  return [];
};

const findByUniqueBarcode = async (product) => {
  const normalized = cleanBarcode(product.barcode);
  if (!normalized) return null;

  const response = await requestWithRetry(
    () =>
      axios.get(MOYSKLAD_ASSORTMENT_URL, {
        headers,
        timeout: 30000,
        params: { filter: `barcode=${normalized}`, limit: 100 },
      }),
    `MoySklad ISBN qidiruvi (${normalized})`,
  );
  const exactMatches = (response?.data?.rows || []).filter(
    (assortment) => getPrimaryMoyskladBarcode(assortment) === normalized,
  );

  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  if (exactMatches.length > 1) {
    const coverKeywords = getCoverKeywords(product.cover);
    const coverMatches = exactMatches.filter((assortment) => {
      const name = assortment.name?.toString().toLowerCase() || "";
      return coverKeywords.some((keyword) => name.includes(keyword));
    });

    if (coverMatches.length === 1) {
      return coverMatches[0];
    }

    throw new Error(
      `MoySklad'da ${normalized} ISBN bilan bir nechta mahsulot topildi, muqova turi bo'yicha ajratib bo'lmadi`,
    );
  }

  return null;
};

const saveMoyskladId = async (product, assortment) => {
  const owner = await Product.findOne({
    _id: { $ne: product._id },
    moyskladId: assortment.id,
  })
    .select("_id")
    .lean();

  if (owner) {
    throw new Error(
      `MoySklad ${assortment.id} mahsuloti boshqa Book.uz kitobiga bog'langan`,
    );
  }

  await Product.updateOne(
    { _id: product._id },
    { $set: { moyskladId: assortment.id } },
  );
  product.moyskladId = assortment.id;

  return assortment;
};

const ensureMoyskladProductOnce = async (product) => {
  if (!TOKEN) {
    throw new Error("MOYSKLAD_API_KEY topilmadi");
  }

  const bookuzId = product._id.toString();
  let assortment = await findByUniqueBarcode(product);

  if (!assortment) {
    assortment = await findByCode(product.barcode);
  }

  if (!assortment) {
    assortment = await findByExternalCode(bookuzId);
  }

  if (!assortment) {
    throw new Error(
      `MoySklad'da Book.uz ${bookuzId} kitobiga mos mavjud mahsulot topilmadi`,
    );
  }

  return saveMoyskladId(product, assortment);
};

const ensureMoyskladProduct = (product) => {
  const bookuzId = product._id.toString();
  const activeLink = linkingByProductId.get(bookuzId);
  if (activeLink) return activeLink;

  const linkPromise = ensureMoyskladProductOnce(product).finally(() => {
    linkingByProductId.delete(bookuzId);
  });
  linkingByProductId.set(bookuzId, linkPromise);

  return linkPromise;
};

module.exports = {
  ensureMoyskladProduct,
};
