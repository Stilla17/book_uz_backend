const axios = require("axios");

const Catalog = require("../models/Catalog");
const {
  getMoyskladBaseUrl,
  logMoyskladError,
  moyskladHeaders,
  requestWithRetry,
} = require("../utils/moyskladClient");

const TOKEN = process.env.MOYSKLAD_API_KEY;
const MOYSKLAD_BASE_URL = getMoyskladBaseUrl();
const MOYSKLAD_ASSORTMENT_URL = `${MOYSKLAD_BASE_URL}/entity/assortment`;
const VAT_RATE = 0.12;
const WHOLESALE_PRICE_TYPE = "оптовая цена";

const createCatalogSyncError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeExternalCode = (value) => value?.toString().trim() || "";

const calculatePriceWithVat = (wholesalePrice) =>
  Math.round(Number(wholesalePrice) * (1 + VAT_RATE));

const getPriceTypeName = (price) => {
  const priceType = price?.priceType;

  if (typeof priceType === "string") return priceType.trim();
  return priceType?.name?.toString().trim() || "";
};

const getWholesalePrice = (assortment) => {
  const wholesalePrice = assortment?.salePrices?.find(
    (salePrice) =>
      getPriceTypeName(salePrice).toLocaleLowerCase("ru-RU") ===
      WHOLESALE_PRICE_TYPE,
  );
  const value = Number(wholesalePrice?.value);

  if (!Number.isFinite(value) || value <= 0) {
    throw createCatalogSyncError(
      `MoySklad mahsulotida "Оптовая цена" topilmadi: ${assortment?.externalCode || assortment?.id || "noma'lum"}`,
      422,
    );
  }

  return value / 100;
};

const fetchAssortment = async (field, value) => {
  const response = await requestWithRetry(
    () =>
      axios.get(MOYSKLAD_ASSORTMENT_URL, {
        headers: moyskladHeaders(TOKEN),
        timeout: 30000,
        params: { filter: `${field}=${value}`, limit: 2 },
      }),
    `MoySklad katalog qidiruvi (${field}=${value})`,
  );

  return response?.data?.rows || [];
};

const resolveCatalogPrice = async ({ externalCode, moyskladId }) => {
  if (!TOKEN) {
    throw createCatalogSyncError("MOYSKLAD_API_KEY topilmadi", 503);
  }

  const normalizedExternalCode = normalizeExternalCode(externalCode);
  if (!normalizedExternalCode) {
    throw createCatalogSyncError("Внешний код majburiy");
  }

  let assortment = null;

  if (moyskladId) {
    const rows = await fetchAssortment("id", moyskladId);
    const linkedAssortment = rows[0];

    if (
      linkedAssortment &&
      linkedAssortment.externalCode === normalizedExternalCode
    ) {
      assortment = linkedAssortment;
    }
  }

  if (!assortment) {
    const rows = await fetchAssortment("externalCode", normalizedExternalCode);

    if (rows.length > 1) {
      throw createCatalogSyncError(
        `MoySklad'da ${normalizedExternalCode} Внешний код bilan bir nechta mahsulot topildi`,
        409,
      );
    }

    assortment = rows[0];
  }

  if (!assortment) {
    throw createCatalogSyncError(
      `MoySklad'da ${normalizedExternalCode} Внешний код bilan mahsulot topilmadi`,
      404,
    );
  }

  const wholesalePrice = getWholesalePrice(assortment);
  const price = calculatePriceWithVat(wholesalePrice);

  return {
    moyskladId: assortment.id,
    moyskladExternalCode: normalizedExternalCode,
    wholesalePrice,
    price,
    priceSyncedAt: new Date(),
    priceSyncStatus: "synced",
    priceSyncError: undefined,
  };
};

const syncMoyskladCatalogs = async () => {
  const catalogs = await Catalog.find({
    moyskladExternalCode: { $exists: true, $nin: [null, ""] },
  }).select("_id moyskladId moyskladExternalCode");

  let synchronized = 0;
  let failed = 0;

  for (const catalog of catalogs) {
    try {
      const priceData = await resolveCatalogPrice({
        externalCode: catalog.moyskladExternalCode,
        moyskladId: catalog.moyskladId,
      });

      await Catalog.updateOne(
        { _id: catalog._id },
        {
          $set: priceData,
          $unset: { priceSyncError: "" },
        },
      );
      synchronized += 1;
    } catch (error) {
      failed += 1;
      await Catalog.updateOne(
        { _id: catalog._id },
        {
          $set: {
            priceSyncStatus: "error",
            priceSyncError: (error.message || String(error)).slice(0, 1000),
          },
        },
      );
      logMoyskladError(
        `MoySklad katalog narxi sync xatosi (${catalog._id})`,
        error,
      );
    }
  }

  console.log(
    `MoySklad katalog sync yakunlandi: ${synchronized} ta yangilandi, ${failed} ta xato.`,
  );

  return { synchronized, failed };
};

module.exports = {
  calculatePriceWithVat,
  resolveCatalogPrice,
  syncMoyskladCatalogs,
};
