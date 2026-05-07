const Category = require('../../models/Category');
const Product = require('../../models/Product');
const apiResponse = require('../../utils/apiResponse');
const hydrateProductRelations = require('../../utils/hydrateProductRelations');

const getCategoryName = (category) => {
  if (category.title?.uz) return category.title.uz;
  if (typeof category.name === 'string') return category.name;
  return category.name?.uz || '';
};

const getSubgenreName = (subgenre) => {
  if (!subgenre) return '';
  if (subgenre.title?.uz) return subgenre.title.uz;
  if (typeof subgenre.name === 'string') return subgenre.name;
  if (typeof subgenre === 'string') return subgenre;
  return subgenre.name?.uz || '';
};

const getIdString = (value) => {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
};

const getCategorySubgenres = (category) => {
  if (Array.isArray(category.subgenres) && category.subgenres.length) {
    return category.subgenres;
  }

  if (!Array.isArray(category.subcategories)) {
    return [];
  }

  return category.subcategories.map((subcategory, index) => ({
    _id: category.subcategoryIds?.[index] || subcategory,
    name: getSubgenreName(subcategory),
    order: index,
    isActive: true
  }));
};

const buildCategoryTree = async (filter = {}) => {
  const categories = await Category.find(filter).sort({ order: 1, createdAt: -1 }).lean();

  if (!categories.length) {
    return [];
  }

  const categoryIds = categories.map((category) => category._id).filter(Boolean);

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
    categoryCounts
      .filter((item) => item._id)
      .map((item) => [getIdString(item._id), item.count])
  );

  const subcategoryCountMap = new Map(
    subcategoryCounts
      .filter((item) => item._id?.category && item._id?.subCategoryId)
      .map((item) => [
        `${getIdString(item._id.category)}:${getIdString(item._id.subCategoryId)}`,
        item.count
      ])
  );

  return categories.filter((category) => category._id).map((category) => {
    const subgenres = getCategorySubgenres(category);
    const categoryId = getIdString(category._id);

    const normalizedSubgenres = subgenres
      .filter(Boolean)
      .filter((subgenre) => subgenre.isActive !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((subgenre) => ({
        ...subgenre,
        name: getSubgenreName(subgenre),
        bookCount: subcategoryCountMap.get(`${categoryId}:${getIdString(subgenre._id)}`) || 0
      }));

    return {
      ...category,
      name: getCategoryName(category),
      bookCount: categoryCountMap.get(categoryId) || 0,
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
      name: getCategoryName(category),
      bookCount,
      subgenres: getCategorySubgenres(category)
        .filter((subgenre) => subgenre.isActive !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((subgenre) => ({
          ...subgenre,
          name: getSubgenreName(subgenre),
          bookCount: subcategoryCountMap.get(getIdString(subgenre._id)) || 0
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
      .populate('author')
      .populate('publisher')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));
    const hydratedProducts = await hydrateProductRelations(products);

    const total = await Product.countDocuments(filter);

    return apiResponse(res, 200, true, "Kategoriya kitoblari", {
      products: hydratedProducts,
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
