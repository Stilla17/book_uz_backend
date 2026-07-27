const Category = require("../../models/Category");
const Product = require("../../models/Product");
const apiResponse = require("../../utils/apiResponse");
const hydrateProductRelations = require("../../utils/hydrateProductRelations");
const {
  applyActiveDiscountsToProducts,
} = require("../../utils/productDiscounts");
const {
  getCategoryName,
  getSubgenreName,
  getIdString,
  getCategorySubgenres,
} = require("../../utils/categoryView");

const buildCategoryTree = async (filter = {}) => {
  const categories = await Category.find(filter)
    .sort({ order: 1, createdAt: -1 })
    .lean();

  if (!categories.length) {
    return [];
  }

  const categoryCounts = await Promise.all(
    categories.map(async (category) => {
      const categoryId = category._id;
      const count = await Product.countDocuments({
        isActive: true,
        $or: [{ category: categoryId }, { categories: categoryId }],
      });

      return [getIdString(categoryId), count];
    }),
  );
  const subcategoryCounts = await Promise.all(
    categories.flatMap((category) =>
      getCategorySubgenres(category).map(async (subgenre) => {
        const subCategoryId = subgenre._id;
        const count = await Product.countDocuments({
          isActive: true,
          $or: [
            { subCategoryId },
            { subCategoryIds: subCategoryId },
          ],
        });

        return [getIdString(subCategoryId), count];
      }),
    ),
  );

  const categoryCountMap = new Map(categoryCounts);
  const subcategoryCountMap = new Map(subcategoryCounts);

  return categories
    .filter((category) => category._id)
    .map((category) => {
      const subgenres = getCategorySubgenres(category);
      const categoryId = getIdString(category._id);

      const normalizedSubgenres = subgenres
        .filter(Boolean)
        .filter((subgenre) => subgenre.isActive !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((subgenre) => ({
          ...subgenre,
          name: getSubgenreName(subgenre),
          bookCount: subcategoryCountMap.get(getIdString(subgenre._id)) || 0,
        }));

      return {
        ...category,
        name: getCategoryName(category),
        bookCount: categoryCountMap.get(categoryId) || 0,
        subgenres: normalizedSubgenres,
        subcategories: normalizedSubgenres,
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
    if (all !== "true") {
      filter.isActive = true;
    }

    const categoriesWithCount = await buildCategoryTree(filter);

    return apiResponse(
      res,
      200,
      true,
      "Kategoriyalar ro'yxati",
      categoriesWithCount,
    );
  } catch (error) {
    console.error("Error in getAllCategories:", error);
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
    console.error("Error in getCategoryTree:", error);
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

    const categoryId = category._id;
    const [bookCount, subcategoryCounts] = await Promise.all([
      Product.countDocuments({
        isActive: true,
        $or: [
          { category: categoryId },
          { categories: categoryId },
          { "category._id": categoryId },
          { "category.id": categoryId },
        ],
      }),
      Promise.all(
        getCategorySubgenres(category).map(async (subgenre) => ({
          _id: subgenre._id,
          count: await Product.countDocuments({
            isActive: true,
            $or: [
              { subCategoryId: subgenre._id },
              { subCategoryIds: subgenre._id },
            ],
          }),
        })),
      ),
    ]);

    const subcategoryCountMap = new Map(
      subcategoryCounts.map((item) => [item._id.toString(), item.count]),
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
          bookCount: subcategoryCountMap.get(getIdString(subgenre._id)) || 0,
        })),
    };

    categoryData.subcategories = categoryData.subgenres;

    return apiResponse(res, 200, true, "Kategoriya ma'lumotlari", categoryData);
  } catch (error) {
    console.error("Error in getCategoryBySlug:", error);
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
    const {
      page = 1,
      limit = 12,
      sort,
      minPrice,
      maxPrice,
      author,
      publisher,
      publish,
      language,
      format,
    } = req.query;

    const category = await Category.findOne({ slug });
    if (!category) {
      return apiResponse(res, 404, false, "Kategoriya topilmadi");
    }

    let filter = {
      isActive: true,
      $or: [{ category: category._id }, { categories: category._id }],
    };

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
      case "price-asc":
        sortOption.price = 1;
        break;
      case "price-desc":
        sortOption.price = -1;
        break;
      case "rating":
        sortOption.ratingAvg = -1;
        break;
      case "newest":
        sortOption.createdAt = -1;
        break;
      case "popular":
        sortOption.views = -1;
        break;
      default:
        sortOption.createdAt = -1;
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(filter)
      .populate("author")
      .populate("publisher")
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));
    const hydratedProducts = await hydrateProductRelations(products);
    const discountedProducts =
      await applyActiveDiscountsToProducts(hydratedProducts);

    const total = await Product.countDocuments(filter);

    return apiResponse(res, 200, true, "Kategoriya kitoblari", {
      products: discountedProducts,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error in getCategoryProducts:", error);
    next(error);
  }
};

module.exports = {
  getAllCategories,
  getCategoryTree,
  getCategoryBySlug,
  getCategoryProducts,
};
