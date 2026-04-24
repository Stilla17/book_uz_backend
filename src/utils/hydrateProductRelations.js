const Author = require('../models/Author');
const Product = require('../models/Product');
const Publisher = require('../models/Publisher');

const normalizeEmbeddedRelation = (relation) => {
  const value = Array.isArray(relation) ? relation[0] : relation;

  if (!value || typeof value !== 'object') {
    return null;
  }

  return {
    ...value,
    _id: value._id || value.id || null,
    externalId: value.externalId || value.id || null,
    name: value.name || value.title || "Noma'lum",
  };
};

const normalizeEmbeddedRelationList = (relation) => {
  if (!Array.isArray(relation)) {
    const normalized = normalizeEmbeddedRelation(relation);
    return normalized ? [normalized] : null;
  }

  const normalizedRelations = relation
    .map((item) => normalizeEmbeddedRelation(item))
    .filter(Boolean);

  return normalizedRelations.length ? normalizedRelations : null;
};

const hydrateProductRelations = async (products) => {
  const isList = Array.isArray(products);
  const productList = isList ? products : [products];
  const productObjects = productList
    .filter(Boolean)
    .map((product) =>
      typeof product.toObject === 'function' ? product.toObject() : product,
    );

  const missingAuthorIds = productObjects
    .filter((product) => !product.author)
    .map((product) => product._id)
    .filter(Boolean);
  const missingPublisherIds = productObjects
    .filter((product) => !product.publisher)
    .map((product) => product._id)
    .filter(Boolean);
  const missingCategoryIds = productObjects
    .filter((product) => !product.category)
    .map((product) => product._id)
    .filter(Boolean);

  const [authors, publishers, publisherCount, defaultPublisher] = await Promise.all([
    missingAuthorIds.length
      ? Author.find({ books: { $in: missingAuthorIds } }).lean()
      : [],
    missingPublisherIds.length
      ? Publisher.find({ books: { $in: missingPublisherIds } }).lean()
      : [],
    missingPublisherIds.length ? Publisher.countDocuments() : 0,
    missingPublisherIds.length ? Publisher.findOne().sort({ createdAt: 1 }).lean() : null,
  ]);

  const rawProducts = await Product.collection
    .find({
      _id: {
        $in: [
          ...new Set([
            ...missingAuthorIds,
            ...missingPublisherIds,
            ...missingCategoryIds,
          ]),
        ],
      },
    })
    .toArray();
  const rawProductById = new Map(
    rawProducts.map((product) => [product._id.toString(), product]),
  );

  const authorByBook = new Map();
  authors.forEach((author) => {
    (author.books || []).forEach((bookId) => {
      authorByBook.set(bookId.toString(), author);
    });
  });

  const publisherByBook = new Map();
  publishers.forEach((publisher) => {
    (publisher.books || []).forEach((bookId) => {
      publisherByBook.set(bookId.toString(), publisher);
    });
  });

  const hydratedProducts = productObjects.map((product) => {
    const productId = product._id?.toString();

    return {
      ...product,
      author:
        product.author ||
        authorByBook.get(productId) ||
        normalizeEmbeddedRelation(rawProductById.get(productId)?.author),
      publisher:
        product.publisher ||
        publisherByBook.get(productId) ||
        normalizeEmbeddedRelation(rawProductById.get(productId)?.publisher) ||
        (publisherCount === 1 ? defaultPublisher : null),
      category:
        product.category ||
        normalizeEmbeddedRelationList(rawProductById.get(productId)?.category),
    };
  });

  return isList ? hydratedProducts : hydratedProducts[0];
};

module.exports = hydrateProductRelations;
