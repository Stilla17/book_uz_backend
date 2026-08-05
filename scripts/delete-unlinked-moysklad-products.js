const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const { EJSON } = require("bson");
const Product = require("../src/models/Product");

const OUTPUT_DIRECTORY = path.resolve(__dirname, "../exports");

const timestampForFile = () =>
  new Date().toISOString().replace(/[:.]/g, "-");

const collectionDocuments = async (db, collectionName, filter) =>
  db.collection(collectionName).find(filter).toArray();

const buildInFilter = (ids) => ({ $in: ids });

const createBackup = async (db, products, ids) => {
  const inFilter = buildInFilter(ids);
  const backup = {
    metadata: {
      createdAt: new Date(),
      reason: "Products without moyskladId removed by explicit user request",
      productCount: products.length,
    },
    products,
    relations: {
      categories: await collectionDocuments(db, "categories", {
        "subgenres.books": inFilter,
      }),
      authors: await collectionDocuments(db, "authors", {
        books: inFilter,
      }),
      publishers: await collectionDocuments(db, "publishers", {
        books: inFilter,
      }),
      carts: await collectionDocuments(db, "carts", {
        "items.product": inFilter,
      }),
      coupons: await collectionDocuments(db, "coupons", {
        applicableProducts: inFilter,
      }),
      discounts: await collectionDocuments(db, "discounts", {
        products: inFilter,
      }),
      comments: await collectionDocuments(db, "comments", {
        book: inFilter,
      }),
      reviews: await collectionDocuments(db, "reviews", {
        product: inFilter,
      }),
      usersWithWishlist: await collectionDocuments(db, "users", {
        wishlist: inFilter,
      }),
      usersWithPurchases: await collectionDocuments(db, "users", {
        "purchasedBooks.product": inFilter,
      }),
      orders: await collectionDocuments(db, "orders", {
        "items.product": inFilter,
      }),
      topSales: await collectionDocuments(db, "moyskladtopsales", {
        "products.product": inFilter,
      }),
    },
  };

  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const backupFile = path.join(
    OUTPUT_DIRECTORY,
    `unlinked-moysklad-products-backup-${timestampForFile()}.json`,
  );
  fs.writeFileSync(backupFile, EJSON.stringify(backup, null, 2), "utf8");

  const parsedBackup = EJSON.parse(fs.readFileSync(backupFile, "utf8"));
  if (
    !Array.isArray(parsedBackup.products) ||
    parsedBackup.products.length !== products.length
  ) {
    throw new Error("Zaxira nusxa tekshiruvidan o'tmadi");
  }

  return backupFile;
};

const deleteProductsAndCleanRelations = async (db, ids, session) => {
  const inFilter = buildInFilter(ids);
  const options = { session };
  const results = {};

  results.categories = await db.collection("categories").updateMany(
    { "subgenres.books": inFilter },
    { $pull: { "subgenres.$[].books": inFilter } },
    options,
  );
  results.authors = await db.collection("authors").updateMany(
    { books: inFilter },
    { $pull: { books: inFilter } },
    options,
  );
  results.publishers = await db.collection("publishers").updateMany(
    { books: inFilter },
    { $pull: { books: inFilter } },
    options,
  );
  results.coupons = await db.collection("coupons").updateMany(
    { applicableProducts: inFilter },
    { $pull: { applicableProducts: inFilter } },
    options,
  );
  results.discounts = await db.collection("discounts").updateMany(
    { products: inFilter },
    { $pull: { products: inFilter } },
    options,
  );
  results.wishlists = await db.collection("users").updateMany(
    { wishlist: inFilter },
    { $pull: { wishlist: inFilter } },
    options,
  );
  results.topSales = await db.collection("moyskladtopsales").updateMany(
    { "products.product": inFilter },
    { $pull: { products: { product: inFilter } } },
    options,
  );
  results.carts = await db.collection("carts").updateMany(
    { "items.product": inFilter },
    [
      {
        $set: {
          items: {
            $filter: {
              input: "$items",
              as: "item",
              cond: { $not: { $in: ["$$item.product", ids] } },
            },
          },
        },
      },
      {
        $set: {
          totalPrice: {
            $reduce: {
              input: "$items",
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  { $multiply: ["$$this.price", "$$this.quantity"] },
                ],
              },
            },
          },
        },
      },
    ],
    options,
  );
  results.comments = await db
    .collection("comments")
    .deleteMany({ book: inFilter }, options);
  results.reviews = await db
    .collection("reviews")
    .deleteMany({ product: inFilter }, options);
  results.products = await db
    .collection("products")
    .deleteMany({ _id: inFilter }, options);

  return results;
};

const summarizeResults = (results) =>
  Object.fromEntries(
    Object.entries(results).map(([key, value]) => [
      key,
      {
        matched: value.matchedCount,
        modified: value.modifiedCount,
        deleted: value.deletedCount,
      },
    ]),
  );

const main = async () => {
  if (!process.argv.includes("--apply")) {
    throw new Error("O'chirish uchun --apply parametri majburiy");
  }
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI topilmadi");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const allProducts = await Product.find({}).lean();
  const productsToDelete = allProducts.filter(
    (product) => !product.moyskladId,
  );

  if (!productsToDelete.length) {
    console.log("O'chiriladigan bog'lanmagan mahsulot qolmagan");
    return;
  }

  const ids = productsToDelete.map((product) => product._id);
  const backupFile = await createBackup(db, productsToDelete, ids);
  const session = await mongoose.startSession();
  let results;

  try {
    await session.withTransaction(async () => {
      results = await deleteProductsAndCleanRelations(db, ids, session);
      if (results.products.deletedCount !== productsToDelete.length) {
        throw new Error(
          `Kutilgan ${productsToDelete.length}, o'chirilgan ${results.products.deletedCount}`,
        );
      }
    });
  } finally {
    await session.endSession();
  }

  const remainingProducts = await Product.find({})
    .select("_id moyskladId")
    .lean();
  const remainingUnlinked = remainingProducts.filter(
    (product) => !product.moyskladId,
  ).length;

  if (remainingUnlinked !== 0) {
    throw new Error(
      `Yakuniy tekshiruvda ${remainingUnlinked} ta bog'lanmagan mahsulot qoldi`,
    );
  }

  console.log(
    EJSON.stringify(
      {
        backupFile,
        deletedProducts: productsToDelete.length,
        remainingProducts: remainingProducts.length,
        remainingUnlinked,
        historicalOrdersPreserved: true,
        purchasedBooksHistoryPreserved: true,
        cloudinaryImagesPreserved: productsToDelete.filter(
          (product) => Boolean(product.image),
        ).length,
        cleanup: summarizeResults(results),
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error) => {
    console.error("Bog'lanmagan mahsulotlarni o'chirish xatosi:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
