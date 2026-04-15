const Category = require('../../models/Category');
const Product = require('../../models/Product');
const apiResponse = require('../../utils/apiResponse');

const buildCategoryTree = async (filter = {}) => {
  const categories = await Category.find(filter).sort({ order: 1, createdAt: -1 }).lean();

  if (!categories.length) {
    return [];
  }

  const categoryIds = categories.map((category) => category._id);

  const [categoryCounts, subcategoryCounts] = await Promise.all([
    Product.aggregate([
      { $match: { category: { $in: categoryIds } } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]),
    Product.aggregate([
      {
        $match: {
          category: { $in: categoryIds },
          subCategoryId: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: { category: '$category', subCategoryId: '$subCategoryId' },
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const categoryCountMap = new Map(
    categoryCounts.map((item) => [item._id.toString(), item.count])
  );

  const subcategoryCountMap = new Map(
    subcategoryCounts.map((item) => [
      `${item._id.category.toString()}:${item._id.subCategoryId.toString()}`,
      item.count
    ])
  );

  return categories.map((category) => {
    const subgenres = Array.isArray(category.subgenres) ? category.subgenres : [];

    const normalizedSubgenres = subgenres
      .filter((subgenre) => subgenre.isActive !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((subgenre) => ({
        ...subgenre,
        name: subgenre.title?.uz || '',
        bookCount: subcategoryCountMap.get(`${category._id.toString()}:${subgenre._id.toString()}`) || 0
      }));

    return {
      ...category,
      name: category.title?.uz || '',
      bookCount: categoryCountMap.get(category._id.toString()) || 0,
      subgenres: normalizedSubgenres,
      subcategories: normalizedSubgenres
    };
  });
};

/**
 * GET /api/v1/categories
 * Barcha kategoriyalarni olish (faol va tartiblangan)
 */
const getAllCategories = async (req, res, next) => {
  try {
    const { all } = req.query;

    let filter = {};
    if (all !== 'true') {
      filter.isActive = true;
    }

    const categoriesWithCount = await buildCategoryTree(filter);

    return apiResponse(res, 200, true, "Kategoriyalar ro'yxati", categoriesWithCount);
  } catch (error) {
    console.error('Error in getAllCategories:', error);
    next(error);
  }
};

/**
 * GET /api/v1/categories/tree
 * Frontend menu uchun tayyor category tree
 */
const getCategoryTree = async (req, res, next) => {
  try {
    const categories = await buildCategoryTree({ isActive: true });

    return apiResponse(res, 200, true, "Kategoriya tree", categories);
  } catch (error) {
    console.error('Error in getCategoryTree:', error);
    next(error);
  }
};

/**
 * GET /api/v1/categories/:slug
 * Kategoriyani slug bo'yicha olish
 */

const getCategoryBySlug = async (req, res, next) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug }).lean();

    if (!category) {
      return apiResponse(res, 404, false, "Kategoriya topilmadi");
    }

    const [bookCount, subcategoryCounts] = await Promise.all([
      Product.countDocuments({ category: category._id }),
      Product.aggregate([
        {
          $match: {
            category: category._id,
            subCategoryId: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$subCategoryId',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const subcategoryCountMap = new Map(
      subcategoryCounts.map((item) => [item._id.toString(), item.count])
    );

    const categoryData = {
      ...category,
      name: category.title?.uz || '',
      bookCount,
      subgenres: (category.subgenres || [])
        .filter((subgenre) => subgenre.isActive !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((subgenre) => ({
          ...subgenre,
          name: subgenre.title?.uz || '',
          bookCount: subcategoryCountMap.get(subgenre._id.toString()) || 0
        }))
    };

    categoryData.subcategories = categoryData.subgenres;

    return apiResponse(res, 200, true, "Kategoriya ma'lumotlari", categoryData);
  } catch (error) {
    console.error('Error in getCategoryBySlug:', error);
    next(error);
  }
};

/**
 * GET /api/v1/categories/:slug/products
 * Kategoriyadagi kitoblarni olish
 */

const getCategoryProducts = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 12, sort, minPrice, maxPrice, author, publisher, publish, language, format } = req.query;

    const category = await Category.findOne({ slug });
    if (!category) {
      return apiResponse(res, 404, false, "Kategoriya topilmadi");
    }

    let filter = { category: category._id };

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (author) filter.author = author;
    if (publisher || publish) filter.publisher = publisher || publish;
    if (language) filter.language = language;
    if (format) filter.format = format;

    // Sortlash
    let sortOption = {};
    switch (sort) {
      case 'price-asc':
        sortOption.price = 1;
        break;
      case 'price-desc':
        sortOption.price = -1;
        break;
      case 'rating':
        sortOption.ratingAvg = -1;
        break;
      case 'newest':
        sortOption.createdAt = -1;
        break;
      case 'popular':
        sortOption.views = -1;
        break;
      default:
        sortOption.createdAt = -1;
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(filter)
      .populate('author', 'name')
      .populate('publisher', 'name slug image')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments(filter);

    return apiResponse(res, 200, true, "Kategoriya kitoblari", {
      products,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('Error in getCategoryProducts:', error);
    next(error);
  }
};

module.exports = {
  getAllCategories,
  getCategoryTree,
  getCategoryBySlug,
  getCategoryProducts
};
