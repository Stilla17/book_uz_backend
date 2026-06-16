const mongoose = require("mongoose");
const Product = require("../models/Product");
const Author = require("../models/Author");
const Publisher = require("../models/Publisher");
const Category = require("../models/Category");
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
    filter.$or = [
      { slug: regex },
      { "title.uz": regex },
      { "title.ru": regex },
      { "title.en": regex },
      { "description.uz": regex },
      { "description.ru": regex },
      { "description.en": regex },
    ];
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

  return products.map((product) => formatProductForAI(product, refs));
};

module.exports = {
  searchBooks,
};
