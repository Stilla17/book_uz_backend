const Publisher = require('../../models/Publisher');
const Product = require('../../models/Product');
const apiResponse = require('../../utils/apiResponse');
const hydrateProductRelations = require('../../utils/hydrateProductRelations');
const { buildSearchRegex } = require('../../utils/searchRegex');
const {
  buildPublisherQuery,
  getPublisherBooksCount,
} = require('../../utils/publisher');

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
    const { search, page = 1, limit = 50, minimal } = req.query;
    const isMinimal = minimal === 'true';
    const normalizedLimit = Math.min(Number(limit) || 50, isMinimal ? 1000 : 100);
    const skip = (Number(page) - 1) * normalizedLimit;

    const filter = {};
    if (search) {
      filter.name = buildSearchRegex(search);
    }

    const publisherQuery = Publisher.find(filter)
      .sort('name')
      .skip(skip)
      .limit(normalizedLimit);

    if (isMinimal) {
      publisherQuery.select('name slug image');
    }

    const [publishers, total] = await Promise.all([
      publisherQuery.lean(),
      Publisher.countDocuments(filter)
    ]);

    if (isMinimal) {
      return apiResponse(res, 200, true, "Nashriyotlar ro'yxati", {
        publishers,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / normalizedLimit),
          limit: normalizedLimit
        }
      });
    }

    const publishersWithBookCount = await Promise.all(
      publishers.map(async (publisher) => {
        return {
          ...publisher,
          booksCount: await getPublisherBooksCount(publisher)
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

    return apiResponse(res, 200, true, "Nashriyot ma'lumotlari", {
      ...publisher,
      booksCount: await getPublisherBooksCount(publisher)
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
    const filter = {
      $or: [
        { publisher: publisher._id },
        ...(publisherBookIds.length ? [{ _id: { $in: publisherBookIds } }] : []),
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
