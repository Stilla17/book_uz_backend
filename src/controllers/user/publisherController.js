const Publisher = require('../../models/Publisher');
const Product = require('../../models/Product');
const apiResponse = require('../../utils/apiResponse');
const hydrateProductRelations = require('../../utils/hydrateProductRelations');

const buildPublisherQuery = (idOrSlug) => {
  if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
    return { _id: idOrSlug };
  }

  return { slug: idOrSlug };
};

const getSortOption = (sort) => {
  switch (sort) {
    case 'price_asc':
    case 'price-asc':
      return { price: 1 };
    case 'price_desc':
    case 'price-desc':
      return { price: -1 };
    case 'rating':
      return { ratingAvg: -1 };
    case 'newest':
    default:
      return { createdAt: -1 };
  }
};

const getAllPublishers = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const normalizedLimit = Math.min(Number(limit) || 50, 100);
    const skip = (Number(page) - 1) * normalizedLimit;

    const filter = {};
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const [publishers, total] = await Promise.all([
      Publisher.find(filter)
        .sort('name')
        .skip(skip)
        .limit(normalizedLimit)
        .lean(),
      Publisher.countDocuments(filter)
    ]);

    const totalProductsWithoutPublisher = await Product.countDocuments({
      $or: [
        { publisher: { $exists: false } },
        { publisher: null }
      ]
    });
    const useDefaultPublisherFallback = total === 1;

    const publishersWithBookCount = await Promise.all(
      publishers.map(async (publisher) => {
        const publisherBookIds = Array.isArray(publisher.books) ? publisher.books : [];
        const booksCount = await Product.countDocuments({
          $or: [
            { publisher: publisher._id },
            ...(publisherBookIds.length ? [{ _id: { $in: publisherBookIds } }] : []),
            ...(useDefaultPublisherFallback
              ? [{ publisher: { $exists: false } }, { publisher: null }]
              : [])
          ]
        });

        return {
          ...publisher,
          booksCount: useDefaultPublisherFallback
            ? Math.max(booksCount, totalProductsWithoutPublisher)
            : booksCount
        };
      })
    );

    return apiResponse(res, 200, true, "Nashriyotlar ro'yxati", {
      publishers: publishersWithBookCount,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / normalizedLimit),
        limit: normalizedLimit
      }
    });
  } catch (error) {
    next(error);
  }
};

const getPublisherByIdOrSlug = async (req, res, next) => {
  try {
    const publisher = await Publisher.findOne(buildPublisherQuery(req.params.id)).lean();

    if (!publisher) {
      return apiResponse(res, 404, false, "Nashriyot topilmadi");
    }

    const publisherBookIds = Array.isArray(publisher.books) ? publisher.books : [];
    const useDefaultPublisherFallback = await Publisher.countDocuments() === 1;
    const booksCount = await Product.countDocuments({
      $or: [
        { publisher: publisher._id },
        ...(publisherBookIds.length ? [{ _id: { $in: publisherBookIds } }] : []),
        ...(useDefaultPublisherFallback
          ? [{ publisher: { $exists: false } }, { publisher: null }]
          : [])
      ]
    });

    return apiResponse(res, 200, true, "Nashriyot ma'lumotlari", {
      ...publisher,
      booksCount
    });
  } catch (error) {
    next(error);
  }
};

const getPublisherProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, sort } = req.query;
    const normalizedLimit = Math.min(Number(limit) || 12, 100);
    const skip = (Number(page) - 1) * normalizedLimit;

    const publisher = await Publisher.findOne(buildPublisherQuery(req.params.id)).lean();
    if (!publisher) {
      return apiResponse(res, 404, false, "Nashriyot topilmadi");
    }

    const publisherBookIds = Array.isArray(publisher.books) ? publisher.books : [];
    const useDefaultPublisherFallback = await Publisher.countDocuments() === 1;
    const filter = {
      $or: [
        { publisher: publisher._id },
        ...(publisherBookIds.length ? [{ _id: { $in: publisherBookIds } }] : []),
        ...(useDefaultPublisherFallback
          ? [{ publisher: { $exists: false } }, { publisher: null }]
          : [])
      ]
    };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'title name subgenres')
        .populate('author')
        .populate('publisher')
        .sort(getSortOption(sort))
        .skip(skip)
        .limit(normalizedLimit),
      Product.countDocuments(filter)
    ]);

    const hydratedProducts = await hydrateProductRelations(products);

    return apiResponse(res, 200, true, "Nashriyot kitoblari", {
      publisher,
      products: hydratedProducts,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / normalizedLimit),
        limit: normalizedLimit
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPublishers,
  getPublisherByIdOrSlug,
  getPublisherProducts
};
