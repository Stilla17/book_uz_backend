const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const axios = require("axios");
const mongoose = require("mongoose");
const Product = require("../src/models/Product");
const {
  cleanBarcode,
  getMoyskladBaseUrl,
  moyskladHeaders,
  requestWithRetry,
} = require("../src/utils/moyskladClient");

const APPLY_CHANGES = process.argv.includes("--apply");
const PAGE_SIZE = 1000;
const BULK_SIZE = 500;
const BASE_URL = getMoyskladBaseUrl();
const HEADERS = moyskladHeaders(process.env.MOYSKLAD_API_KEY);
const SALE_PRICE_TYPE = process.env.MOYSKLAD_SALE_PRICE_TYPE || "Цена продажи";

const groupBy = (items, getKeys) => {
  const grouped = new Map();

  items.forEach((item) => {
    const keys = Array.isArray(getKeys(item)) ? getKeys(item) : [getKeys(item)];
    [...new Set(keys.filter(Boolean))].forEach((key) => {
      const matches = grouped.get(key) || [];
      matches.push(item);
      grouped.set(key, matches);
    });
  });

  return grouped;
};

const getAllMoyskladBarcodes = (assortment) => {
  const values = [];

  (assortment.barcodes || []).forEach((barcode) => {
    Object.values(barcode).forEach((value) => {
      const cleaned = cleanBarcode(value);
      if (cleaned) values.push(cleaned);
    });
  });

  return [...new Set(values)];
};

const transliterate = (value = "") => {
  const letters = {
    а: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e",
    ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", қ: "q",
    л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s",
    т: "t", у: "u", ў: "o", ф: "f", х: "x", ҳ: "h", ц: "s",
    ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e",
    ю: "yu", я: "ya",
  };

  return String(value)
    .toLowerCase()
    .split("")
    .map((letter) => letters[letter] ?? letter)
    .join("");
};

const normalizeTitle = (value) =>
  transliterate(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const titleTokens = (value) =>
  normalizeTitle(value)
    .split(" ")
    .filter((token) => token.length > 1 || /^\d+$/.test(token));

const getLocalTitle = (product) =>
  product.title?.uz || product.title?.ru || product.title?.en || "";

const titleMatchScore = (localTitle, moyskladTitle) => {
  const localTokens = titleTokens(localTitle);
  const moyskladTokens = new Set(titleTokens(moyskladTitle));

  if (localTokens.length < 2) return 0;

  const matches = localTokens.filter((token) => moyskladTokens.has(token));
  return matches.length / localTokens.length;
};

const fetchAllPages = async (url, label) => {
  const firstResponse = await requestWithRetry(
    () =>
      axios.get(url, {
        headers: HEADERS,
        timeout: 180000,
        params: { limit: PAGE_SIZE, offset: 0 },
      }),
    `${label} 1-sahifa`,
  );

  const firstRows = firstResponse?.data?.rows || [];
  const total = Number(firstResponse?.data?.meta?.size || firstRows.length);
  const rows = [...firstRows];

  console.log(`${label}: ${rows.length}/${total}`);

  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
    const response = await requestWithRetry(
      () =>
        axios.get(url, {
          headers: HEADERS,
          timeout: 180000,
          params: { limit: PAGE_SIZE, offset },
        }),
      `${label} offset=${offset}`,
    );

    rows.push(...(response?.data?.rows || []));
    console.log(`${label}: ${Math.min(rows.length, total)}/${total}`);
  }

  return rows;
};

const getSalePrice = (assortment) => {
  const prices = assortment.salePrices || [];
  const selected =
    prices.find((price) => price.priceType?.name === SALE_PRICE_TYPE) ||
    prices[0];
  const value = Number(selected?.value);

  return Number.isFinite(value) && value > 0 ? value / 100 : null;
};

const buildBranchStocks = (stockByStore, syncedAt) =>
  (stockByStore || [])
    .map((storeStock) => {
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
    })
    .filter((item) => item.quantity !== 0 || item.reserve !== 0);

const getAssortmentIdFromStockRow = (row) =>
  row.meta?.href?.split("/").pop()?.split("?")[0] || "";

const resolveProducts = (products, assortments) => {
  const assortmentById = new Map(
    assortments.map((assortment) => [assortment.id, assortment]),
  );
  const assortmentByExternalCode = groupBy(
    assortments,
    (assortment) => assortment.externalCode,
  );
  const productsByBarcode = groupBy(products, (product) =>
    cleanBarcode(product.barcode),
  );
  const assortmentsByBarcode = groupBy(
    assortments,
    getAllMoyskladBarcodes,
  );
  const resolved = new Map();
  const claimedAssortmentIds = new Map();
  const resolutionCounts = {
    moyskladId: 0,
    externalCode: 0,
    uniqueBarcode: 0,
    titleWithinDuplicateBarcode: 0,
  };

  const claim = (product, assortment, method) => {
    const productId = product._id.toString();
    const claimedBy = claimedAssortmentIds.get(assortment.id);
    if (claimedBy && claimedBy !== productId) return false;

    resolved.set(productId, { product, assortment, method });
    claimedAssortmentIds.set(assortment.id, productId);
    resolutionCounts[method] += 1;
    return true;
  };

  products.forEach((product) => {
    const assortment = product.moyskladId
      ? assortmentById.get(product.moyskladId)
      : null;
    if (assortment) claim(product, assortment, "moyskladId");
  });

  products.forEach((product) => {
    const productId = product._id.toString();
    if (resolved.has(productId)) return;

    const matches = assortmentByExternalCode.get(productId) || [];
    if (matches.length === 1) claim(product, matches[0], "externalCode");
  });

  products.forEach((product) => {
    const productId = product._id.toString();
    if (resolved.has(productId)) return;

    const barcode = cleanBarcode(product.barcode);
    if (!barcode) return;

    const localMatches = productsByBarcode.get(barcode) || [];
    const moyskladMatches = assortmentsByBarcode.get(barcode) || [];
    if (localMatches.length !== 1 || moyskladMatches.length !== 1) return;

    claim(product, moyskladMatches[0], "uniqueBarcode");
  });

  const ambiguousBarcodes = [...productsByBarcode.keys()].filter((barcode) => {
    const localUnresolved = (productsByBarcode.get(barcode) || []).filter(
      (product) => !resolved.has(product._id.toString()),
    );
    const moyskladUnclaimed = (assortmentsByBarcode.get(barcode) || []).filter(
      (assortment) => !claimedAssortmentIds.has(assortment.id),
    );

    return localUnresolved.length && moyskladUnclaimed.length;
  });

  ambiguousBarcodes.forEach((barcode) => {
    const localUnresolved = (productsByBarcode.get(barcode) || []).filter(
      (product) => !resolved.has(product._id.toString()),
    );
    const moyskladUnclaimed = (assortmentsByBarcode.get(barcode) || []).filter(
      (assortment) => !claimedAssortmentIds.has(assortment.id),
    );
    const candidates = [];

    localUnresolved.forEach((product) => {
      moyskladUnclaimed.forEach((assortment) => {
        candidates.push({
          product,
          assortment,
          score: titleMatchScore(getLocalTitle(product), assortment.name),
        });
      });
    });

    candidates
      .filter((candidate) => candidate.score >= 0.8)
      .sort((left, right) => right.score - left.score)
      .forEach((candidate) => {
        const productId = candidate.product._id.toString();
        if (resolved.has(productId)) return;
        if (claimedAssortmentIds.has(candidate.assortment.id)) return;

        const sameProductScores = candidates
          .filter(
            (item) =>
              item.product._id.toString() === productId &&
              item.assortment.id !== candidate.assortment.id,
          )
          .map((item) => item.score);
        const sameAssortmentScores = candidates
          .filter(
            (item) =>
              item.assortment.id === candidate.assortment.id &&
              item.product._id.toString() !== productId,
          )
          .map((item) => item.score);
        const competingScore = Math.max(
          0,
          ...sameProductScores,
          ...sameAssortmentScores,
        );

        if (candidate.score - competingScore < 0.2) return;
        claim(
          candidate.product,
          candidate.assortment,
          "titleWithinDuplicateBarcode",
        );
      });
  });

  return { resolved, resolutionCounts };
};

const bulkWriteInChunks = async (operations) => {
  let modifiedCount = 0;

  for (let index = 0; index < operations.length; index += BULK_SIZE) {
    const chunk = operations.slice(index, index + BULK_SIZE);
    const result = await Product.bulkWrite(chunk, { ordered: false });
    modifiedCount += result.modifiedCount;
    console.log(
      `MongoDB: ${Math.min(index + chunk.length, operations.length)}/${operations.length}`,
    );
  }

  return modifiedCount;
};

const main = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI topilmadi");
  if (!process.env.MOYSKLAD_API_KEY) {
    throw new Error("MOYSKLAD_API_KEY topilmadi");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const products = await Product.find({})
    .select("_id title barcode price stock branchStocks moyskladId")
    .lean();
  console.log(`Book.uz mahsulotlari: ${products.length}`);

  const assortments = await fetchAllPages(
    `${BASE_URL}/entity/assortment`,
    "MoySklad assortment",
  );
  const { resolved, resolutionCounts } = resolveProducts(
    products,
    assortments,
  );

  const summary = {
    mode: APPLY_CHANGES ? "apply" : "dry-run",
    products: products.length,
    assortments: assortments.length,
    resolved: resolved.size,
    unresolved: products.length - resolved.size,
    ...resolutionCounts,
  };
  console.log("Bog'lash natijasi:", JSON.stringify(summary, null, 2));

  if (!APPLY_CHANGES) {
    console.log("O'zgarish kiritish uchun --apply parametrini bering.");
    return;
  }

  const stockRows = await fetchAllPages(
    `${BASE_URL}/report/stock/bystore`,
    "MoySklad qoldiq",
  );
  const stockByAssortmentId = new Map(
    stockRows.map((row) => [getAssortmentIdFromStockRow(row), row.stockByStore]),
  );
  const syncedAt = new Date();
  const operations = [];

  resolved.forEach(({ product, assortment }) => {
    const price = getSalePrice(assortment);
    const branchStocks = buildBranchStocks(
      stockByAssortmentId.get(assortment.id),
      syncedAt,
    );
    const stock = Math.max(
      branchStocks.reduce((total, item) => total + item.available, 0),
      0,
    );
    const updateFields = {
      moyskladId: assortment.id,
      stock,
      branchStocks,
    };

    if (price !== null) updateFields.price = price;

    operations.push({
      updateOne: {
        filter: { _id: product._id },
        update: { $set: updateFields },
      },
    });
  });

  const modifiedCount = await bulkWriteInChunks(operations);
  console.log(
    `Tayyor: ${operations.length} ta mahsulot tekshirildi, ${modifiedCount} ta mahsulot o'zgardi.`,
  );
};

main()
  .catch((error) => {
    const message =
      error.response?.data?.errors?.[0]?.error || error.message || error;
    console.error("Bulk sync xatosi:", message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
