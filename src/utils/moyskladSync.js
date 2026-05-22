const axios = require("axios");
const cron = require("node-cron");
const Product = require("../models/Product");

const MOYSKLAD_API_URL = process.env.MOYSKLAD_API_URL;
const TOKEN = process.env.MOYSKLAD_API_KEY;

// API bloklanmasligi uchun kutish funksiyasi
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const STOCK_REQUEST_DELAY_MS = 1200;
const CHUNK_DELAY_MS = 3000;
const RETRY_DELAYS_MS = [5000, 15000, 30000];

const getMoyskladBaseUrl = () => {
  if (!MOYSKLAD_API_URL) {
    return "https://api.moysklad.ru/api/remap/1.2";
  }

  const marker = "/api/remap/1.2";
  const markerIndex = MOYSKLAD_API_URL.indexOf(marker);

  if (markerIndex === -1) {
    return MOYSKLAD_API_URL.replace(/\/entity\/assortment.*$/, "");
  }

  return MOYSKLAD_API_URL.slice(0, markerIndex + marker.length);
};

const MOYSKLAD_BASE_URL = getMoyskladBaseUrl();
const MOYSKLAD_ASSORTMENT_URL = `${MOYSKLAD_BASE_URL}/entity/assortment`;

const moyskladHeaders = {
  Authorization: `Bearer ${TOKEN}`,
  "Cache-Control": "no-cache",
};

const cleanBarcode = (barcode) => barcode?.toString().replace(/\D/g, "") || "";

const getMoyskladBarcode = (msProduct) => {
  const barcodeObj = msProduct.barcodes && msProduct.barcodes[0];
  return barcodeObj ? Object.values(barcodeObj)[0] : null;
};

const getAxiosStatus = (error) => error.response?.status;

const logMoyskladError = (label, error) => {
  const status = getAxiosStatus(error);
  const message = error.response?.data?.errors?.[0]?.error || error.message;

  console.error(`${label}: ${status || "NO_STATUS"} - ${message}`);
};

const requestWithRetry = async (requestFn, label) => {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await requestFn();
    } catch (error) {
      const status = getAxiosStatus(error);
      const canRetry = status === 429 && attempt < RETRY_DELAYS_MS.length;

      if (!canRetry) {
        throw error;
      }

      const waitMs = RETRY_DELAYS_MS[attempt];
      console.warn(
        `${label}: MoySklad limitiga urildi, ${Math.round(waitMs / 1000)} sekund kutamiz...`,
      );
      await delay(waitMs);
    }
  }

  return null;
};

const buildBranchStocks = (stockByStore, syncedAt) =>
  (stockByStore || []).map((storeStock) => {
    const quantity = Number(storeStock.stock || 0);
    const reserve = Number(storeStock.reserve || 0);

    return {
      storeId: storeStock.meta?.href?.split("/").pop() || "",
      storeName: storeStock.name || "",
      quantity,
      reserve,
      available: Math.max(quantity - reserve, 0),
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
        headers: moyskladHeaders,
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
        headers: moyskladHeaders,
        timeout: 30000,
        params: { filter: filterString },
      }),
    "MoySklad assortment so'rovi",
  );

const syncMoyskladProducts = async () => {
  try {
    console.log("🔄 Sinxronizatsiya boshlandi...");

    // 1. Bazadan ma'lumotni olamiz
    const myProducts = await Product.find({}, "barcode price").lean();

    // 2. Map yaratamiz (Qidiruvni million marta tezlashtiradi)
    // Kalit sifatida tozalangan barcodeni saqlaymiz
    const barcodeLookup = new Map();
    myProducts.forEach((p) => {
      if (p.barcode) {
        const clean = cleanBarcode(p.barcode);
        barcodeLookup.set(clean, { id: p._id, originalBarcode: p.barcode });
      }
    });

    const myCleanBarcodes = Array.from(barcodeLookup.keys());
    if (myCleanBarcodes.length === 0) return;

    let updatedCount = 0;
    const chunkSize = 50;
    let canSyncBranchStocks = true;

    for (let i = 0; i < myCleanBarcodes.length; i += chunkSize) {
      const chunk = myCleanBarcodes.slice(i, i + chunkSize);
      const filterString = chunk.map((bc) => `barcode=${bc}`).join(";");

      let response;

      try {
        response = await fetchAssortmentChunk(filterString);
      } catch (assortmentError) {
        logMoyskladError("MoySklad assortment sync xatosi", assortmentError);
        break;
      }

      const msProducts = response.data.rows;

      if (msProducts && msProducts.length > 0) {
        // 🚀 ENDI BULK (OMMAVIY) YANGILASH TAYYORLAYMIZ
        const bulkOps = [];

        for (const msProduct of msProducts) {
          const msBarcodeRaw = getMoyskladBarcode(msProduct);
          const msPrice =
            msProduct.salePrices && msProduct.salePrices[0]?.value / 100;

          if (msBarcodeRaw) {
            const cleanMs = cleanBarcode(msBarcodeRaw);
            const myMatch = barcodeLookup.get(cleanMs);

            if (myMatch) {
              const updateFields = {
                ...(msPrice ? { price: msPrice } : {}),
              };

              if (canSyncBranchStocks) {
                try {
                  const syncedAt = new Date();
                  const stockByStore = await fetchBranchStocks(
                    msProduct.meta?.href,
                  );
                  const branchStocks = buildBranchStocks(
                    stockByStore,
                    syncedAt,
                  );
                  const totalAvailable = branchStocks.reduce(
                    (total, item) => total + item.available,
                    0,
                  );

                  updateFields.stock = totalAvailable;
                  updateFields.branchStocks = branchStocks;
                } catch (stockError) {
                  logMoyskladError(
                    `MoySklad qoldiq sync xatosi (${msBarcodeRaw})`,
                    stockError,
                  );

                  if (getAxiosStatus(stockError) === 403) {
                    canSyncBranchStocks = false;
                    console.error(
                      "MoySklad tokenida report/stock/bystore uchun ruxsat yo'q. Narx sync davom etadi, branchStocks yangilanmaydi.",
                    );
                  }
                }
              }

              // Har birini alohida update qilmasdan, ro'yxatga yig'amiz
              if (Object.keys(updateFields).length > 0) {
                bulkOps.push({
                  updateOne: {
                    filter: { _id: myMatch.id },
                    update: { $set: updateFields },
                  },
                });
              }

              await delay(STOCK_REQUEST_DELAY_MS);
            }
          }
        }

        // 3. Bir martada hamma o'zgarganlarni bazaga jo'natamiz (Juda tez!)
        if (bulkOps.length > 0) {
          const res = await Product.bulkWrite(bulkOps);
          updatedCount += res.modifiedCount;
        }
      }

      // MoySklad va Protsessorga dam beramiz
      await delay(CHUNK_DELAY_MS);
    }

    console.log(`✅ Yakunlandi. ${updatedCount} ta narx yangilandi.`);
  } catch (error) {
    console.error("❌ Xato:", error.message);
  }
};
// Cron Job: Har soatda bir marta ishga tushadi (00:00, 01:00 va h.k.)
const startSyncCron = () => {
  cron.schedule("0 */5 * * *", () => {
    syncMoyskladProducts();
  });
};

module.exports = { syncMoyskladProducts, startSyncCron };
