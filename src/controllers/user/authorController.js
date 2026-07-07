const Author = require("../../models/Author");
const Product = require("../../models/Product");
const apiResponse = require("../../utils/apiResponse");
const hydrateProductRelations = require("../../utils/hydrateProductRelations");
const {
  applyActiveDiscountsToProducts,
} = require("../../utils/productDiscounts");
const { buildSearchRegex } = require("../../utils/searchRegex");

const buildAuthorQuery = (idOrSlug) => {
  if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
    return { _id: idOrSlug };
  }

  return { slug: idOrSlug };
};

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

const getAllAuthors = async (req, res, next) => {
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

    const authorQuery = Author.find(filter)
      .sort("name")
      .skip(skip)
      .limit(normalizedLimit);

    if (isMinimal) {
      authorQuery.select("name slug image");
    }

    const [authors, total] = await Promise.all([
      authorQuery.lean(),
      Author.countDocuments(filter),
    ]);

    if (isMinimal) {
      return apiResponse(res, 200, true, "Mualliflar ro'yxati", {
        authors,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / normalizedLimit),
          limit: normalizedLimit,
        },
      });
    }

    const authorsWithBookCount = await Promise.all(
      authors.map(async (author) => {
        const authorBookIds = Array.isArray(author.books) ? author.books : [];
        const booksCount = await Product.countDocuments({
          $or: [
            { author: author._id },
            ...(authorBookIds.length ? [{ _id: { $in: authorBookIds } }] : []),
          ],
        });

        return {
          ...author,
          booksCount,
        };
      }),
    );

    return apiResponse(res, 200, true, "Mualliflar ro'yxati", {
      authors: authorsWithBookCount,
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

const getAuthorByIdOrSlug = async (req, res, next) => {
  try {
    const author = await Author.findOne(buildAuthorQuery(req.params.id)).lean();

    if (!author) {
      return apiResponse(res, 404, false, "Muallif topilmadi");
    }

    const authorBookIds = Array.isArray(author.books) ? author.books : [];
    const booksCount = await Product.countDocuments({
      $or: [
        { author: author._id },
        ...(authorBookIds.length ? [{ _id: { $in: authorBookIds } }] : []),
      ],
    });

    return apiResponse(res, 200, true, "Muallif ma'lumotlari", {
      ...author,
      booksCount,
    });
  } catch (error) {
    next(error);
  }
};

const getAuthorProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, sort } = req.query;
    const normalizedLimit = Math.min(Number(limit) || 12, 100);
    const skip = (Number(page) - 1) * normalizedLimit;

    const author = await Author.findOne(buildAuthorQuery(req.params.id)).lean();
    if (!author) {
      return apiResponse(res, 404, false, "Muallif topilmadi");
    }

    const authorBookIds = Array.isArray(author.books) ? author.books : [];
    const filter = {
      $or: [
        { author: author._id },
        ...(authorBookIds.length ? [{ _id: { $in: authorBookIds } }] : []),
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

    return apiResponse(res, 200, true, "Muallif kitoblari", {
      author,
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

const getTopAuthors = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const topAuthors = await Author.aggregate([
      {
        $addFields: {
          booksCount: {
            $size: {
              $ifNull: ["$books", []],
            },
          },
        },
      },
      { $match: { booksCount: { $gt: 0 } } },
      { $sort: { booksCount: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          name: 1,
          slug: 1,
          image: 1,
          booksCount: 1,
        },
      },
    ]);

    return apiResponse(res, 200, true, "Top Authors", {
      authors: topAuthors,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllAuthors,
  getAuthorByIdOrSlug,
  getAuthorProducts,
  getTopAuthors,
};
