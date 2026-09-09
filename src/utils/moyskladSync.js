const axios = require("axios");
const Product = require("../models/Product");
const TOKEN = process.env.MOYSKLAD_API_KEY;
const {
  ensureMoyskladProduct,
} = require("../services/moyskladProductLinkService");
const {
  delay,
  getMoyskladBaseUrl,
  moyskladHeaders,
  getAxiosStatus,
  logMoyskladError,
  requestWithRetry,
} = require("./moyskladClient");
const { calculateRetailStock } = require("./moyskladStock");

const STOCK_REQUEST_DELAY_MS = 1200;
const CHUNK_DELAY_MS = 3000;
const ASSORTMENT_CHUNK_SIZE = 50;
const SEVEN_HOURS_IN_MS = 7 * 60 * 60 * 1000;

let isSyncing = false;

const MOYSKLAD_BASE_URL = getMoyskladBaseUrl();
const MOYSKLAD_ASSORTMENT_URL = `${MOYSKLAD_BASE_URL}/entity/assortment`;
const headers = moyskladHeaders(TOKEN);

const buildBranchStocks = (stockByStore, syncedAt) =>
  (stockByStore || []).map((storeStock) => {
    const quantity = Number(storeStock.stock || 0);
    const reserve = Number(storeStock.reserve || 0);

    return {
      storeId: storeStock.meta?.href?.split("/").pop() || "",
      storeName: storeStock.name || "",
      quantity,
      reserve,
      available: quantity - reserve,
      syncedAt,
    };
  });

const fetchBranchStocks = async (productHref) => {
  if (!productHref) {
    return [];
  }

  const response = await requestWithRetry(
    () =>
      axios.get(`${MOYSKLAD_BASE_URL}/report/stock/bystore`, {
        headers,
        timeout: 30000,
        params: {
          filter: `product=${productHref}`,
        },
      }),
    "MoySklad qoldiq so'rovi",
  );

  return response?.data.rows?.[0]?.stockByStore || [];
};

const fetchAssortmentChunk = async (filterString) =>
  requestWithRetry(
    () =>
      axios.get(MOYSKLAD_ASSORTMENT_URL, {
        headers,
        timeout: 30000,
        params: { filter: filterString },
      }),
    "MoySklad assortment so'rovi",
  );

const fetchAssortmentByField = async (field, values) => {
  const uniqueValues = [...new Set(values.filter(Boolean))];
  const rows = [];

  for (let i = 0; i < uniqueValues.length; i += ASSORTMENT_CHUNK_SIZE) {
    const chunk = uniqueValues.slice(i, i + ASSORTMENT_CHUNK_SIZE);
    const filterString = chunk.map((value) => `${field}=${value}`).join(";");
    const response = await fetchAssortmentChunk(filterString);

    rows.push(...(response?.data?.rows || []));

    if (i + ASSORTMENT_CHUNK_SIZE < uniqueValues.length) {
      await delay(CHUNK_DELAY_MS);
    }
  }

  return rows;
};

const groupByExternalCode = (assortmentRows) => {
  const result = new Map();

  assortmentRows.forEach((assortment) => {
    if (!assortment.externalCode) return;

    const matches = result.get(assortment.externalCode) || [];
    matches.push(assortment);
    result.set(assortment.externalCode, matches);
  });

  return result;
};

const syncMoyskladProducts = async (options = {}) => {
  if (isSyncing) {
    console.log("MoySklad sinxronizatsiyasi hali davom etmoqda");
    return;
  }

  isSyncing = true;

  try {
    console.log("MoySklad mahsulot sinxronizatsiyasi boshlandi...");

    const productFilter = options.productIds?.length
      ? { _id: { $in: options.productIds } }
      : {};
    const myProducts = await Product.find(
      productFilter,
      "_id price moyskladId moyskladExternalCode title",
    ).lean();

    if (!myProducts.length) {
      console.log("MoySklad sync: Book.uz bazasida mahsulot topilmadi");
      return;
    }

    // Asosiy bog'lanish faqat MoySklad UUID orqali qilinadi.
    const linkedRows = await fetchAssortmentByField(
      "id",
      myProducts.map((product) => product.moyskladId),
    );
    const assortmentById = new Map(
      linkedRows.map((assortment) => [assortment.id, assortment]),
    );

    // moyskladId yo'qolgan yoki hali yozilmagan mahsulotlarni MoySklad'dagi
    // real externalCode orqali tiklaymiz. ISBN/barcode ishlatilmaydi.
    const unresolvedProducts = myProducts.filter(
      (product) =>
        !product.moyskladId || !assortmentById.has(product.moyskladId),
    );
    const externalCodeRows = await fetchAssortmentByField(
      "externalCode",
      unresolvedProducts.map((product) => product.moyskladExternalCode),
    );
    const assortmentByExternalCode = groupByExternalCode(externalCodeRows);
    const claimedMoyskladIds = new Map();
    let resolvedProducts = [];
    const conflictedProductIds = new Set();

    myProducts.forEach((product) => {
      const bookuzId = product._id.toString();
      const expectedExternalCode = product.moyskladExternalCode;
      let assortment = product.moyskladId
        ? assortmentById.get(product.moyskladId)
        : null;

      if (
        assortment &&
        expectedExternalCode &&
        assortment.externalCode !== expectedExternalCode
      ) {
        conflictedProductIds.add(bookuzId);
        console.warn(
          `MoySklad sync: ${bookuzId} externalCode mos emas (${expectedExternalCode} != ${assortment.externalCode || "bo'sh"})`,
        );
        return;
      }

      if (!assortment && expectedExternalCode) {
        const externalCodeMatches =
          assortmentByExternalCode.get(expectedExternalCode) || [];

        if (externalCodeMatches.length > 1) {
          conflictedProductIds.add(bookuzId);
          return;
        }

        assortment = externalCodeMatches[0];
      }

      if (!assortment) return;

      const claimedBy = claimedMoyskladIds.get(assortment.id);
      if (claimedBy && claimedBy !== bookuzId) {
        conflictedProductIds.add(bookuzId);
        conflictedProductIds.add(claimedBy);
        return;
      }

      claimedMoyskladIds.set(assortment.id, bookuzId);
      resolvedProducts.push({ product, assortment, bookuzId });
    });

    const claimedExternalCodes = new Map();
    resolvedProducts.forEach(({ assortment, bookuzId }) => {
      if (!assortment.externalCode) return;

      const claimedBy = claimedExternalCodes.get(assortment.externalCode);
      if (claimedBy && claimedBy !== bookuzId) {
        conflictedProductIds.add(bookuzId);
        conflictedProductIds.add(claimedBy);
        return;
      }

      claimedExternalCodes.set(assortment.externalCode, bookuzId);
    });
    resolvedProducts = resolvedProducts.filter(
      ({ bookuzId }) => !conflictedProductIds.has(bookuzId),
    );

    const resolvedBookuzIds = new Set(
      resolvedProducts.map((resolved) => resolved.product._id.toString()),
    );
    const productsToAutoLink = myProducts.filter(
      (product) =>
        !resolvedBookuzIds.has(product._id.toString()) &&
        Boolean(product.moyskladExternalCode) &&
        !conflictedProductIds.has(product._id.toString()),
    );

    for (const product of productsToAutoLink) {
      const bookuzId = product._id.toString();

      try {
        const assortment = await ensureMoyskladProduct(product);
        const claimedBy = claimedMoyskladIds.get(assortment.id);

        if (claimedBy && claimedBy !== bookuzId) {
          conflictedProductIds.add(bookuzId);
          conflictedProductIds.add(claimedBy);
          continue;
        }

        claimedMoyskladIds.set(assortment.id, bookuzId);
        resolvedProducts.push({ product, assortment, bookuzId });
        console.log(
          `MoySklad auto-link: ${bookuzId} -> ${assortment.id}`,
        );
      } catch (autoLinkError) {
        logMoyskladError(
          `MoySklad auto-link xatosi (${bookuzId})`,
          autoLinkError,
        );
      }
    }

    let synchronizedCount = 0;
    let externalCodeBackfilledCount = 0;
    let canSyncBranchStocks = true;
    const bulkOps = [];

    for (const { product, assortment } of resolvedProducts) {
      const salePriceValue = assortment.salePrices?.[0]?.value;
      const numericSalePrice = Number(salePriceValue);
      const updateFields = {
        moyskladId: assortment.id,
        ...(assortment.externalCode
          ? { moyskladExternalCode: assortment.externalCode }
          : {}),
        ...(salePriceValue !== null &&
        salePriceValue !== undefined &&
        Number.isFinite(numericSalePrice) &&
        numericSalePrice > 0
          ? { price: numericSalePrice / 100 }
          : {}),
      };

      if (!product.moyskladExternalCode && assortment.externalCode) {
        externalCodeBackfilledCount += 1;
      }

      if (canSyncBranchStocks) {
        try {
          const syncedAt = new Date();
          const stockByStore = await fetchBranchStocks(assortment.meta?.href);
          const branchStocks = buildBranchStocks(stockByStore, syncedAt);
          const totalAvailable = calculateRetailStock(branchStocks);

          updateFields.stock = totalAvailable;
          updateFields.branchStocks = branchStocks;
        } catch (stockError) {
          logMoyskladError(
            `MoySklad qoldiq sync xatosi (${assortment.id})`,
            stockError,
          );

          if (getAxiosStatus(stockError) === 403) {
            canSyncBranchStocks = false;
            console.error(
              "MoySklad tokenida report/stock/bystore uchun ruxsat yo'q. Narx sync davom etadi, branchStocks yangilanmaydi.",
            );
          }
        }

        await delay(STOCK_REQUEST_DELAY_MS);
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: product._id },
          update: { $set: updateFields },
        },
      });
      synchronizedCount += 1;
    }

    if (bulkOps.length) {
      await Product.bulkWrite(bulkOps);
    }

    if (conflictedProductIds.size) {
      console.warn(
        `MoySklad sync: ${conflictedProductIds.size} ta mahsulot bog'lanish konflikti sabab o'tkazib yuborildi`,
      );
    }

    const unlinkedCount = myProducts.length - synchronizedCount;
    if (unlinkedCount) {
      console.warn(
        `MoySklad sync: ${unlinkedCount} ta mahsulotda moyskladId yoki mos externalCode topilmadi`,
      );
    }

    console.log(
      `MoySklad sync yakunlandi. ${synchronizedCount} ta mahsulot sinxronlandi, ${externalCodeBackfilledCount} ta externalCode Book.uz bazasiga saqlandi.`,
    );
  } catch (error) {
    logMoyskladError("MoySklad mahsulot sync xatosi", error);
  } finally {
    isSyncing = false;
  }
};

// Server ishga tushgan vaqtdan boshlab har 7 soatda sinxronizatsiya qiladi.
const startSyncCron = () => {
  setInterval(() => {
    syncMoyskladProducts();
  }, SEVEN_HOURS_IN_MS);

  console.log("MoySklad sinxronizatsiyasi har 7 soatga sozlandi");
};

module.exports = { syncMoyskladProducts, startSyncCron };
