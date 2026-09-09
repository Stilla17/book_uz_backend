const axios = require("axios");
const Product = require("../models/Product");
const {
  getMoyskladBaseUrl,
  moyskladHeaders,
  requestWithRetry,
} = require("../utils/moyskladClient");

const TOKEN = process.env.MOYSKLAD_API_KEY;
const MOYSKLAD_BASE_URL = getMoyskladBaseUrl();
const MOYSKLAD_ASSORTMENT_URL = `${MOYSKLAD_BASE_URL}/entity/assortment`;
const headers = moyskladHeaders(TOKEN);

const linkingByProductId = new Map();

const findByExternalCode = async (externalCode) => {
  const response = await requestWithRetry(
    () =>
      axios.get(MOYSKLAD_ASSORTMENT_URL, {
        headers,
        timeout: 30000,
        params: { filter: `externalCode=${externalCode}`, limit: 2 },
      }),
    `MoySklad externalCode qidiruvi (${externalCode})`,
  );
  const rows = response?.data?.rows || [];

  if (rows.length > 1) {
    throw new Error(
      `MoySklad'da ${externalCode} externalCode bilan bir nechta mahsulot topildi`,
    );
  }

  return rows[0] || null;
};

const saveMoyskladLink = async (product, assortment, externalCode) => {
  const idOwner = await Product.findOne({
    _id: { $ne: product._id },
    moyskladId: assortment.id,
  })
    .select("_id")
    .lean();

  if (idOwner) {
    throw new Error(
      `MoySklad ${assortment.id} mahsuloti boshqa Book.uz kitobiga bog'langan`,
    );
  }

  const externalCodeOwner = await Product.findOne({
    _id: { $ne: product._id },
    moyskladExternalCode: externalCode,
  })
    .select("_id")
    .lean();

  if (externalCodeOwner) {
    throw new Error(
      `MoySklad ${externalCode} externalCode boshqa Book.uz kitobiga bog'langan`,
    );
  }

  await Product.updateOne(
    { _id: product._id },
    {
      $set: {
        moyskladId: assortment.id,
        moyskladExternalCode: externalCode,
      },
    },
  );
  product.moyskladId = assortment.id;
  product.moyskladExternalCode = externalCode;

  return assortment;
};

const ensureMoyskladProductOnce = async (product) => {
  if (!TOKEN) {
    throw new Error("MOYSKLAD_API_KEY topilmadi");
  }

  const bookuzId = product._id.toString();
  const externalCode = product.moyskladExternalCode?.toString().trim();

  if (!externalCode) {
    throw new Error(
      `Book.uz ${bookuzId} kitobida moyskladExternalCode ko'rsatilmagan`,
    );
  }

  const assortment = await findByExternalCode(externalCode);
  if (!assortment) {
    throw new Error(
      `MoySklad'da ${externalCode} externalCode bilan mahsulot topilmadi`,
    );
  }

  return saveMoyskladLink(product, assortment, externalCode);
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
