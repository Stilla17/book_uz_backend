const axios = require("axios");
const cron = require("node-cron");
const Product = require("../models/Product");
const chalk = require("chalk");

const MOYSKLAD_API_URL = process.env.MOYSKLAD_API_URL;
const TOKEN = process.env.MOYSKLAD_API_KEY;

// API bloklanmasligi uchun kutish funksiyasi
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
        const clean = p.barcode.toString().replace(/\D/g, "");
        barcodeLookup.set(clean, { id: p._id, originalBarcode: p.barcode });
      }
    });

    const myCleanBarcodes = Array.from(barcodeLookup.keys());
    if (myCleanBarcodes.length === 0) return;

    let updatedCount = 0;
    const chunkSize = 50;

    for (let i = 0; i < myCleanBarcodes.length; i += chunkSize) {
      const chunk = myCleanBarcodes.slice(i, i + chunkSize);
      const filterString = chunk.map((bc) => `barcode=${bc}`).join(";");

      const response = await axios.get(
        `${MOYSKLAD_API_URL}?filter=${filterString}`,
        {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Cache-Control": "no-cache",
          },
        },
      );

      const msProducts = response.data.rows;

      if (msProducts && msProducts.length > 0) {
        // 🚀 ENDI BULK (OMMAVIY) YANGILASH TAYYORLAYMIZ
        const bulkOps = [];

        for (const msProduct of msProducts) {
          const barcodeObj = msProduct.barcodes && msProduct.barcodes[0];
          const msBarcodeRaw = barcodeObj ? Object.values(barcodeObj)[0] : null;
          const msPrice =
            msProduct.salePrices && msProduct.salePrices[0]?.value / 100;

          if (msBarcodeRaw && msPrice) {
            const cleanMs = msBarcodeRaw.toString().replace(/\D/g, "");
            const myMatch = barcodeLookup.get(cleanMs);

            if (myMatch) {
              // Har birini alohida update qilmasdan, ro'yxatga yig'amiz
              bulkOps.push({
                updateOne: {
                  filter: { _id: myMatch.id, price: { $ne: msPrice } },
                  update: { $set: { price: msPrice } },
                },
              });
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
      await delay(200);
    }

    console.log(
      chalk.blue(`✅ Yakunlandi. ${updatedCount} ta narx yangilandi.`),
    );
  } catch (error) {
    console.error("❌ Xato:", error.message);
  }
};
// Cron Job: Har soatda bir marta ishga tushadi (00:00, 01:00 va h.k.)
const startSyncCron = () => {
  cron.schedule("0 0 * * *", () => {
    syncMoyskladProducts();
  });
};

module.exports = { syncMoyskladProducts, startSyncCron };
