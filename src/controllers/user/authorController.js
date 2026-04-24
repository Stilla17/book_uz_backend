const Author = require('../../models/Author');
const Product = require('../../models/Product');
const apiResponse = require('../../utils/apiResponse');
const hydrateProductRelations = require('../../utils/hydrateProductRelations');

const buildAuthorQuery = (idOrSlug) => {
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

const getAllAuthors = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const normalizedLimit = Math.min(Number(limit) || 50, 100);
    const skip = (Number(page) - 1) * normalizedLimit;

    const filter = {};
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const [authors, total] = await Promise.all([
      Author.find(filter)
        .sort('name')
        .skip(skip)
        .limit(normalizedLimit)
        .lean(),
      Author.countDocuments(filter)
    ]);

    const authorsWithBookCount = await Promise.all(
      authors.map(async (author) => {
        const authorBookIds = Array.isArray(author.books) ? author.books : [];
        const booksCount = await Product.countDocuments({
          $or: [
            { author: author._id },
            ...(authorBookIds.length ? [{ _id: { $in: authorBookIds } }] : [])
          ]
        });

        return {
          ...author,
          booksCount
        };
      })
    );

    return apiResponse(res, 200, true, "Mualliflar ro'yxati", {
      authors: authorsWithBookCount,
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
        ...(authorBookIds.length ? [{ _id: { $in: authorBookIds } }] : [])
      ]
    });

    return apiResponse(res, 200, true, "Muallif ma'lumotlari", {
      ...author,
      booksCount
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
        ...(authorBookIds.length ? [{ _id: { $in: authorBookIds } }] : [])
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

    return apiResponse(res, 200, true, "Muallif kitoblari", {
      author,
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
  getAllAuthors,
  getAuthorByIdOrSlug,
  getAuthorProducts
};
