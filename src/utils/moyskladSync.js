const axios = require("axios");
const crypto = require("crypto");
const os = require("os");
const Product = require("../models/Product");
const SyncJobState = require("../models/SyncJobState");
const TOKEN = process.env.MOYSKLAD_API_KEY;
const {
  ensureMoyskladProduct,
} = require("../services/moyskladProductLinkService");
const {
  syncMoyskladCatalogs,
} = require("../services/moyskladCatalogService");
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
const SCHEDULER_POLL_MS = 60 * 1000;
const RETRY_AFTER_ERROR_MS = 15 * 60 * 1000;
const LOCK_LEASE_MS = 15 * 60 * 1000;
const LOCK_HEARTBEAT_MS = 5 * 60 * 1000;
const SYNC_JOB_NAME = "moysklad-products";
const WORKER_ID = `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`;

let isSyncing = false;
let schedulerTimer = null;
let schedulerCheckRunning = false;

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
    return { skipped: true };
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
      return { synchronized: 0 };
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

    return { synchronized: synchronizedCount };
  } catch (error) {
    logMoyskladError("MoySklad mahsulot sync xatosi", error);
    throw error;
  } finally {
    isSyncing = false;
  }
};

const ensureSyncJobState = async () => {
  try {
    await SyncJobState.updateOne(
      { _id: SYNC_JOB_NAME },
      { $setOnInsert: { nextRunAt: new Date(0) } },
      { upsert: true },
    );
  } catch (error) {
    // Bir nechta instance bir vaqtda birinchi hujjatni yaratsa, bittasi yutadi.
    if (error?.code !== 11000) throw error;
  }
};

const acquireSyncLease = async () => {
  await ensureSyncJobState();

  const now = new Date();
  return SyncJobState.findOneAndUpdate(
    {
      _id: SYNC_JOB_NAME,
      nextRunAt: { $lte: now },
      $or: [
        { lockUntil: { $exists: false } },
        { lockUntil: null },
        { lockUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        lockedBy: WORKER_ID,
        lockUntil: new Date(now.getTime() + LOCK_LEASE_MS),
        lastStartedAt: now,
      },
    },
    { new: true },
  ).lean();
};

const extendSyncLease = () =>
  SyncJobState.updateOne(
    { _id: SYNC_JOB_NAME, lockedBy: WORKER_ID },
    { $set: { lockUntil: new Date(Date.now() + LOCK_LEASE_MS) } },
  ).catch((error) => {
    console.error("MoySklad sync lock yangilash xatosi:", error.message);
  });

const finishScheduledSync = async ({ error, startedAt } = {}) => {
  const now = new Date();
  const successfulNextRunAt = new Date(
    Math.max(
      new Date(startedAt || now).getTime() + SEVEN_HOURS_IN_MS,
      now.getTime() + SCHEDULER_POLL_MS,
    ),
  );
  const update = {
    $set: {
      nextRunAt: error
        ? new Date(now.getTime() + RETRY_AFTER_ERROR_MS)
        : successfulNextRunAt,
      ...(error
        ? {
            lastFailedAt: now,
            lastError: (error.message || String(error)).slice(0, 2000),
          }
        : { lastSucceededAt: now }),
    },
    $unset: {
      lockedBy: "",
      lockUntil: "",
      ...(!error ? { lastError: "" } : {}),
    },
  };

  await SyncJobState.updateOne(
    { _id: SYNC_JOB_NAME, lockedBy: WORKER_ID },
    update,
  );
};

const runScheduledSync = async () => {
  if (schedulerCheckRunning) return;
  schedulerCheckRunning = true;

  let lease;
  try {
    lease = await acquireSyncLease();
    if (!lease) return;

    const heartbeat = setInterval(extendSyncLease, LOCK_HEARTBEAT_MS);
    try {
      const result = await syncMoyskladProducts();
      if (result?.skipped) {
        throw new Error("Mahalliy MoySklad sinxronizatsiyasi hali davom etmoqda");
      }
      await syncMoyskladCatalogs();
      await finishScheduledSync({ startedAt: lease.lastStartedAt });
    } catch (error) {
      await finishScheduledSync({ error });
    } finally {
      clearInterval(heartbeat);
    }
  } catch (error) {
    console.error("MoySklad scheduler xatosi:", error.message);
  } finally {
    schedulerCheckRunning = false;
  }
};

// Holat MongoDB'da saqlanadi: restartdan keyin ham navbatdagi vaqt yo'qolmaydi.
const startSyncCron = () => {
  if (schedulerTimer) return schedulerTimer;

  runScheduledSync();
  schedulerTimer = setInterval(runScheduledSync, SCHEDULER_POLL_MS);

  console.log(
    "MoySklad sinxronizatsiyasi har 7 soatda ishlashga sozlandi (restart-safe)",
  );

  return schedulerTimer;
};

module.exports = { syncMoyskladProducts, startSyncCron, runScheduledSync };
