const axios = require("axios");
const Product = require("../models/Product");
const TOKEN = process.env.MOYSKLAD_API_KEY;
const {
  delay,
  getMoyskladBaseUrl,
  moyskladHeaders,
  cleanBarcode,
  getMoyskladBarcode,
  getAxiosStatus,
  logMoyskladError,
  requestWithRetry,
} = require("./moyskladClient");

const STOCK_REQUEST_DELAY_MS = 1200;
const CHUNK_DELAY_MS = 3000;
const FIVE_HOURS_IN_MS = 5 * 60 * 60 * 1000;

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

const syncMoyskladProducts = async (options = {}) => {
  if (isSyncing) {
    console.log("MoySklad sinxronizatsiyasi hali davom etmoqda");
    return;
  }

  isSyncing = true;

  try {
    console.log("🔄 Sinxronizatsiya boshlandi...");

    const requestedBarcodes = new Set(
      (options.barcodes || []).map(cleanBarcode).filter(Boolean),
    );

    // 1. Bazadan ma'lumotni olamiz
    const myProducts = await Product.find(
      {},
      "barcode price moyskladId title",
    ).lean();

    // 2. Map yaratamiz (Qidiruvni million marta tezlashtiradi)
    // Kalit sifatida tozalangan barcodeni saqlaymiz
    const barcodeLookup = new Map();
    myProducts.forEach((p) => {
      if (p.barcode) {
        const clean = cleanBarcode(p.barcode);
        if (requestedBarcodes.size && !requestedBarcodes.has(clean)) return;

        const products = barcodeLookup.get(clean) || [];
        products.push({
          id: p._id,
          moyskladId: p.moyskladId || "",
          originalBarcode: p.barcode,
          title: p.title,
        });
        barcodeLookup.set(clean, products);
      }
    });

    const myCleanBarcodes = Array.from(barcodeLookup.keys());
    if (myCleanBarcodes.length === 0) return;

    let updatedCount = 0;
    const chunkSize = 50;
    let canSyncBranchStocks = true;
    const conflictedBarcodes = new Set();

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
        const msBarcodeCounts = new Map();
        msProducts.forEach((msProduct) => {
          const barcode = cleanBarcode(getMoyskladBarcode(msProduct));
          if (!barcode) return;
          msBarcodeCounts.set(barcode, (msBarcodeCounts.get(barcode) || 0) + 1);
        });

        // 🚀 ENDI BULK (OMMAVIY) YANGILASH TAYYORLAYMIZ
        const bulkOps = [];

        for (const msProduct of msProducts) {
          const msBarcodeRaw = getMoyskladBarcode(msProduct);
          const msPrice =
            msProduct.salePrices && msProduct.salePrices[0]?.value / 100;

          if (msBarcodeRaw) {
            const cleanMs = cleanBarcode(msBarcodeRaw);
            const localCandidates = barcodeLookup.get(cleanMs) || [];
            const linkedMatch = localCandidates.find(
              (product) => product.moyskladId === msProduct.id,
            );
            const hasUniqueMoyskladBarcode =
              msBarcodeCounts.get(cleanMs) === 1;
            const localMatches = hasUniqueMoyskladBarcode
              ? localCandidates.filter(
                  (product) =>
                    !product.moyskladId ||
                    product.moyskladId === msProduct.id,
                )
              : linkedMatch
                ? [linkedMatch]
                : [];

            if (!localMatches.length && localCandidates.length) {
              conflictedBarcodes.add(cleanMs);
              continue;
            }

            if (localMatches.length) {
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
                  const totalAvailable = Math.max(
                    branchStocks.reduce(
                      (total, item) => total + item.available,
                      0,
                    ),
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

              localMatches.forEach((localMatch) => {
                const matchUpdateFields = { ...updateFields };

                // Duplicate lokal ISBN'larda bitta MoySklad ID'ni bir nechta
                // productga yozib bo'lmaydi. Narx/qoldiq barchasiga yoziladi,
                // ID esa faqat aniq bitta moslik bo'lganda biriktiriladi.
                if (
                  localMatch.moyskladId === msProduct.id ||
                  localMatches.length === 1
                ) {
                  matchUpdateFields.moyskladId = msProduct.id;
                }

                bulkOps.push({
                  updateOne: {
                    filter: { _id: localMatch.id },
                    update: { $set: matchUpdateFields },
                  },
                });
              });

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

    if (conflictedBarcodes.size) {
      console.warn(
        `MoySklad sync: ${conflictedBarcodes.size} ta duplicate barcode moyskladId yo'qligi sabab o'tkazib yuborildi`,
      );
    }

    console.log(`✅ Yakunlandi. ${updatedCount} ta mahsulot yangilandi.`);
  } catch (error) {
    console.error("❌ Xato:", error.message);
  } finally {
    isSyncing = false;
  }
};

// Server ishga tushgan vaqtdan boshlab har 5 soatda sinxronizatsiya qiladi.
const startSyncCron = () => {
  setInterval(() => {
    syncMoyskladProducts();
  }, FIVE_HOURS_IN_MS);

  console.log("MoySklad sinxronizatsiyasi har 5 soatga sozlandi");
};

module.exports = { syncMoyskladProducts, startSyncCron };
