const mongoose = require("mongoose");
const Product = require("../models/Product");
const Author = require("../models/Author");
const Publisher = require("../models/Publisher");
const Category = require("../models/Category");
const { applyActiveDiscountsToProducts } = require("../utils/productDiscounts");
const { buildSearchRegex, normalizeSearchText } = require("../utils/searchRegex");

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value?.toString?.());

const getRefId = (value) => {
  if (!value) return null;
  if (typeof value === "object") {
    return value._id?.toString?.() || value.id?.toString?.() || null;
  }
  return value.toString();
};

const buildRefMap = async (Model, products, fieldName, select) => {
  const ids = [
    ...new Set(
      products
        .map((product) => getRefId(product[fieldName]))
        .filter((id) => id && isObjectId(id)),
    ),
  ];

  if (!ids.length) return new Map();

  const docs = await Model.find({ _id: { $in: ids } }).select(select).lean();
  return new Map(docs.map((doc) => [doc._id.toString(), doc]));
};

const formatRef = (value, refMap, titleField = "name") => {
  const id = getRefId(value);
  const doc = id ? refMap.get(id) : null;

  if (doc) {
    return {
      id: doc._id?.toString(),
      name: doc.name || doc[titleField],
      title: doc.title,
      slug: doc.slug,
    };
  }

  if (value && typeof value === "object") {
    return {
      id: id || null,
      name: value.name || value.title,
      title: value.title,
      slug: value.slug,
    };
  }

  return id ? { id } : null;
};

const getLocalizedText = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.uz || value.ru || value.en || "";
};

const topBooksPattern = /\b(bestseller|best seller|top|ommabop|mashhur|sotuv|eng kop|eng ko'p|reyting)\b/i;

const isTopBooksQuery = (query) => {
  const normalized = normalizeSearchText(query);
  return topBooksPattern.test(normalized);
};

const isOnlyTopBooksQuery = (query) => {
  const normalized = normalizeSearchText(query);
  return !normalized
    .replace(topBooksPattern, "")
    .replace(/\b(kitob|kitoblar|books)\b/gi, "")
    .trim();
};

const formatProductForAI = (product, refs) => ({
  id: product._id.toString(),
  title: product.title,
  slug: product.slug,
  description: product.description,
  price: product.price,
  discountPrice: product.discountPrice,
  stock: product.stock,
  images: product.images,
  language: product.language,
  cover: product.cover,
  ratingAvg: product.ratingAvg,
  author: formatRef(product.author, refs.authors),
  publisher: formatRef(product.publisher, refs.publishers),
  category: formatRef(product.category, refs.categories, "title"),
});

const searchBooks = async ({
  query = "",
  language,
  minPrice,
  maxPrice,
  limit = 8,
} = {}) => {
  const normalizedQuery = normalizeSearchText(query);
  const filter = {};

  if (normalizedQuery) {
    const regex = buildSearchRegex(normalizedQuery);
    const [authors, publishers, categories] = await Promise.all([
      Author.find({ $or: [{ name: regex }, { slug: regex }] })
        .select("_id")
        .limit(20)
        .lean(),
      Publisher.find({ $or: [{ name: regex }, { slug: regex }] })
        .select("_id")
        .limit(20)
        .lean(),
      Category.find({
        $or: [
          { slug: regex },
          { "title.uz": regex },
          { "title.ru": regex },
          { "title.en": regex },
          { "subgenres.slug": regex },
          { "subgenres.title.uz": regex },
          { "subgenres.title.ru": regex },
          { "subgenres.title.en": regex },
        ],
      })
        .select("_id subgenres")
        .limit(20)
        .lean(),
    ]);

    const authorIds = authors.map((author) => author._id);
    const publisherIds = publishers.map((publisher) => publisher._id);
    const categoryIds = categories.map((category) => category._id);
    const subgenreIds = categories.flatMap((category) =>
      (category.subgenres || [])
        .filter((subgenre) => {
          const title = normalizeSearchText(getLocalizedText(subgenre.title));
          const slug = normalizeSearchText(subgenre.slug);
          return title.includes(normalizedQuery) || slug.includes(normalizedQuery);
        })
        .map((subgenre) => subgenre._id),
    );

    filter.$or = [
      { slug: regex },
      { "title.uz": regex },
      { "title.ru": regex },
      { "title.en": regex },
      { "description.uz": regex },
      { "description.ru": regex },
      { "description.en": regex },
    ];

    if (authorIds.length) filter.$or.push({ author: { $in: authorIds } });
    if (publisherIds.length) filter.$or.push({ publisher: { $in: publisherIds } });
    if (categoryIds.length) filter.$or.push({ category: { $in: categoryIds } });
    if (subgenreIds.length) filter.$or.push({ subCategoryId: { $in: subgenreIds } });
  }

  if (isTopBooksQuery(query)) {
    if (isOnlyTopBooksQuery(query)) {
      delete filter.$or;
    }
    filter.isTop = true;
  }

  if (language) {
    filter.language = language;
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
    if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
  }

  const products = await Product.find(filter)
    .sort({ stock: -1, ratingAvg: -1, createdAt: -1 })
    .limit(Math.min(Number(limit) || 8, 10))
    .lean({ getters: false, virtuals: false });

  const refs = {
    authors: await buildRefMap(Author, products, "author", "name slug"),
    publishers: await buildRefMap(Publisher, products, "publisher", "name slug"),
    categories: await buildRefMap(Category, products, "category", "title slug"),
  };

  const discountedProducts = await applyActiveDiscountsToProducts(products);

  return discountedProducts.map((product) => formatProductForAI(product, refs));
};

module.exports = {
  searchBooks,
};
