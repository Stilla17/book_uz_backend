const Publisher = require("../../models/Publisher");
const Product = require("../../models/Product");
const apiResponse = require("../../utils/apiResponse");
const hydrateProductRelations = require("../../utils/hydrateProductRelations");
const {
  applyActiveDiscountsToProducts,
} = require("../../utils/productDiscounts");
const { buildSearchRegex } = require("../../utils/searchRegex");
const {
  buildPublisherQuery,
  getPublisherBooksCount,
} = require("../../utils/publisher");

const getSortOption = (sort) => {
  switch (sort) {
    case "price_asc":
    case "price-asc":
      return { price: 1 };
    case "price_desc":
    case "price-desc":
      return { price: -1 };
    case "rating":
      return { ratingAvg: -1 };
    case "newest":
    default:
      return { createdAt: -1 };
  }
};

//  Barcha Publisherlar

const getAllPublishers = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50, minimal } = req.query;
    const isMinimal = minimal === "true";
    const normalizedLimit = Math.min(
      Number(limit) || 50,
      isMinimal ? 1000 : 100,
    );
    const skip = (Number(page) - 1) * normalizedLimit;

    const filter = {};
    if (search) {
      filter.name = buildSearchRegex(search);
    }

    const publisherQuery = Publisher.find(filter)
      .sort("name")
      .skip(skip)
      .limit(normalizedLimit);

    if (isMinimal) {
      publisherQuery.select("name slug image");
    }

    const [publishers, total] = await Promise.all([
      publisherQuery.lean(),
      Publisher.countDocuments(filter),
    ]);

    if (isMinimal) {
      return apiResponse(res, 200, true, "Nashriyotlar ro'yxati", {
        publishers,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / normalizedLimit),
          limit: normalizedLimit,
        },
      });
    }

    const publishersWithBookCount = await Promise.all(
      publishers.map(async (publisher) => {
        return {
          ...publisher,
          booksCount: await getPublisherBooksCount(publisher),
        };
      }),
    );

    return apiResponse(res, 200, true, "Nashriyotlar ro'yxati", {
      publishers: publishersWithBookCount,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / normalizedLimit),
        limit: normalizedLimit,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Publisherlar slug boyicha

const getPublisherByIdOrSlug = async (req, res, next) => {
  try {
    const publisher = await Publisher.findOne(
      buildPublisherQuery(req.params.id),
    ).lean();

    if (!publisher) {
      return apiResponse(res, 404, false, "Nashriyot topilmadi");
    }

    return apiResponse(res, 200, true, "Nashriyot ma'lumotlari", {
      ...publisher,
      booksCount: await getPublisherBooksCount(publisher),
    });
  } catch (error) {
    next(error);
  }
};

// Publsiherni ichidagi kitoblarni chiqarish

const getPublisherProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, sort } = req.query;
    const normalizedLimit = Math.min(Number(limit) || 12, 100);
    const skip = (Number(page) - 1) * normalizedLimit;

    const publisher = await Publisher.findOne(
      buildPublisherQuery(req.params.id),
    ).lean();
    if (!publisher) {
      return apiResponse(res, 404, false, "Nashriyot topilmadi");
    }

    const publisherBookIds = Array.isArray(publisher.books)
      ? publisher.books
      : [];
    const filter = {
      isActive: true,
      $or: [
        { publisher: publisher._id },
        ...(publisherBookIds.length
          ? [{ _id: { $in: publisherBookIds } }]
          : []),
      ],
    };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category", "title name subgenres")
        .populate("author")
        .populate("publisher")
        .sort(getSortOption(sort))
        .skip(skip)
        .limit(normalizedLimit),
      Product.countDocuments(filter),
    ]);

    const hydratedProducts = await hydrateProductRelations(products);
    const discountedProducts =
      await applyActiveDiscountsToProducts(hydratedProducts);

    return apiResponse(res, 200, true, "Nashriyot kitoblari", {
      publisher,
      products: discountedProducts,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / normalizedLimit),
        limit: normalizedLimit,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getTopPublishers = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);

    const publishers = await Publisher.aggregate([
      {
        $lookup: {
          from: Product.collection.name,
          let: {
            publisherId: "$_id",
            publisherBookIds: {
              $ifNull: ["$books", []],
            },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$isActive", true] },
                    {
                      $or: [
                        {
                          $eq: ["$publisher", "$$publisherId"],
                        },
                        {
                          $in: ["$_id", "$$publisherBookIds"],
                        },
                      ],
                    },
                  ],
                },
              },
            },
            {
              $count: "count",
            },
          ],
          as: "bookStats",
        },
      },
      {
        $addFields: {
          booksCount: {
            $ifNull: [
              {
                $arrayElemAt: ["$bookStats.count", 0],
              },
              0,
            ],
          },
        },
      },
      {
        $sort: {
          booksCount: -1,
          name: 1,
        },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          bookStats: 0,
          books: 0,
        },
      },
    ]);

    return apiResponse(res, 200, true, "Eng ko'p kitobi bor nashriyotlar", {
      publishers,
    });
  } catch (error) {
    next(error);
  }
};

// Eng kop kitobi bor Publisherlar
module.exports = {
  getAllPublishers,
  getPublisherByIdOrSlug,
  getPublisherProducts,
  getTopPublishers,
};
