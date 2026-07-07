const Product = require("../models/Product");

const buildPublisherQuery = (idOrSlug = "") => {
  if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
    return { _id: idOrSlug };
  }

  return { slug: idOrSlug };
};

const getPublisherBooksCount = async (publisher) => {
  const publisherBookIds = Array.isArray(publisher.books) ? publisher.books : [];

  return Product.countDocuments({
    isActive: true,
    $or: [
      { publisher: publisher._id },
      ...(publisherBookIds.length ? [{ _id: { $in: publisherBookIds } }] : []),
    ],
  });
};

module.exports = {
  buildPublisherQuery,
  getPublisherBooksCount,
};
