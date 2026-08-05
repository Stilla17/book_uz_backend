require("dotenv").config();

const dns = require("dns");
const mongoose = require("mongoose");

dns.setServers(["1.1.1.1", "1.0.0.1"]);
dns.setDefaultResultOrder("ipv4first");

const connectDB = require("../src/config/db");

async function migrateProductImages() {
  try {
    await connectDB();

    const products = mongoose.connection.collection("products");
    const result = await products.updateMany(
      { images: { $exists: true } },
      [
        {
          $set: {
            image: {
              $cond: [
                { $gt: [{ $strLenCP: { $ifNull: ["$image", ""] } }, 0] },
                "$image",
                {
                  $ifNull: [
                    {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: { $ifNull: ["$images", []] },
                            as: "url",
                            cond: {
                              $and: [
                                { $ne: ["$$url", null] },
                                { $ne: ["$$url", ""] },
                              ],
                            },
                          },
                        },
                        0,
                      ],
                    },
                    "",
                  ],
                },
              ],
            },
          },
        },
        { $unset: "images" },
      ],
    );

    console.log(
      `${result.matchedCount} ta product tekshirildi, ${result.modifiedCount} tasi yangilandi`,
    );
  } catch (error) {
    console.error("Product rasmlari migratsiyasi xatosi:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

migrateProductImages();
