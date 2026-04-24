const Product = require('../../models/Product');
const Publisher = require('../../models/Publisher');
const apiResponse = require('../../utils/apiResponse');
const hydrateProductRelations = require('../../utils/hydrateProductRelations');

const CATEGORY_SELECT = 'name title subgenres';
const UNKNOWN_AUTHOR = {
  _id: null,
  name: "Noma'lum",
  slug: null,
  image: null,
};
const UNKNOWN_PUBLISHER = {
  _id: null,
  name: "Noma'lum",
  slug: null,
  image: null,
  description: null,
};

const withDisplayFields = (product) => {
  const productObject =
    typeof product.toObject === 'function' ? product.toObject() : product;
  const primaryCategory = Array.isArray(productObject.category)
    ? productObject.category[0]
    : productObject.category;

  return {
    ...productObject,
    author: productObject.author || UNKNOWN_AUTHOR,
    authorName: productObject.author?.name || "Noma'lum",
    publisher: productObject.publisher || UNKNOWN_PUBLISHER,
    publisherName: productObject.publisher?.name || "Noma'lum",
    categoryName:
      primaryCategory?.title?.uz ||
      primaryCategory?.name?.uz ||
      primaryCategory?.name ||
      "Noma'lum",
  };
};

const getWishlistSet = (req) =>
  new Set((req.user?.wishlist || []).map((id) => id.toString()));

const withWishlistField = (product, wishlistSet) => {
  const productObject = withDisplayFields(product);

  return {
    ...productObject,
    isWishlisted: wishlistSet.has(productObject._id?.toString()),
  };
};

/**
 * 1. Murakkab qidiruv, filtr, sort va pagination bilan barcha mahsulotlarni olish
 */
exports.getAllProducts = async (req, res, next) => {
  try {
    const { keyword, category, author, publisher, publish, minPrice, maxPrice, sort, page = 1, limit = 12, subCategoryId, subgenreId, subgenre, language, contentLanguage } = req.query;
    
    let query = {};

    const andFilters = [];

    if (keyword) {
      andFilters.push({
        $or: [
        { "title.uz": { $regex: keyword, $options: 'i' } },
        { "title.ru": { $regex: keyword, $options: 'i' } },
        { "title.en": { $regex: keyword, $options: 'i' } },
        { "description.uz": { $regex: keyword, $options: 'i' } },
        { "description.ru": { $regex: keyword, $options: 'i' } },
        { "description.en": { $regex: keyword, $options: 'i' } },
        { "publisher.name": { $regex: keyword, $options: 'i' } },
        { "author.name": { $regex: keyword, $options: 'i' } },
        ],
      });
    }

    if (category) {
      const categoryFilters = [
        { "category.id": category },
        { "category.name": { $regex: category, $options: 'i' } },
      ];

      if (/^[0-9a-fA-F]{24}$/.test(category)) {
        categoryFilters.unshift({ category });
      }

      andFilters.push({
        $or: categoryFilters,
      });
    }
    if (author) query.author = author;
    const selectedPublisher = publisher || publish;
    if (selectedPublisher) {
      const defaultPublisher = await Publisher.findOne().lean();
      const publisherCount = defaultPublisher ? await Publisher.countDocuments() : 0;
      const matchesDefaultPublisher =
        publisherCount === 1 &&
        defaultPublisher &&
        [
          defaultPublisher._id.toString(),
          defaultPublisher.slug,
          defaultPublisher.name,
        ].includes(selectedPublisher);

      if (matchesDefaultPublisher) {
        andFilters.push({
          $or: [
            { publisher: defaultPublisher._id },
            { publisher: { $exists: false } },
            { publisher: null },
          ],
        });
      } else if (/^[0-9a-fA-F]{24}$/.test(selectedPublisher)) {
        query.publisher = selectedPublisher;
      } else {
        andFilters.push({ "publisher.name": { $regex: selectedPublisher, $options: 'i' } });
      }
    }
    if (language) query.language = language;
    if (contentLanguage) query.contentLanguage = contentLanguage;

    const selectedSubgenre = subCategoryId || subgenreId || subgenre;
    if (selectedSubgenre) query.subCategoryId = selectedSubgenre;

    if (andFilters.length) {
      query.$and = andFilters;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let sortBy = { createdAt: -1, _id: -1 };
    if (sort === 'price_asc') sortBy = { price: 1, _id: -1 };
    if (sort === 'price_desc') sortBy = { price: -1, _id: -1 };
    if (sort === 'rating') sortBy = { ratingAvg: -1, _id: -1 };

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', CATEGORY_SELECT)
        .populate('author')
        .populate('publisher')
        .sort(sortBy)
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(query)
    ]);

    const hydratedProducts = await hydrateProductRelations(products);
    const wishlistSet = getWishlistSet(req);

    apiResponse(res, 200, true, "Mahsulotlar ro'yxati", {
      products: hydratedProducts.map((product) => withWishlistField(product, wishlistSet)),
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. O'xshash mahsulotlarni olish (Recommendations)
 * Bir xil kategoriya yoki muallifga tegishli kitoblarni topish
 */

exports.getRelatedProducts = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return apiResponse(res, 404, false, "Mahsulot topilmadi");

    const related = await Product.find({
      category: product.category,
      ...(product.subCategoryId ? { subCategoryId: product.subCategoryId } : {}),
      _id: { $ne: product._id } 
    })
    .limit(4)
    .populate('category', CATEGORY_SELECT)
    .populate('author')
    .populate('publisher');

    const hydratedRelated = await hydrateProductRelations(related);
    const wishlistSet = getWishlistSet(req);

    apiResponse(
      res,
      200,
      true,
      "O'xshash mahsulotlar",
      hydratedRelated.map((product) => withWishlistField(product, wishlistSet)),
    );
  } catch (error) { next(error); }
};

/**
 * 3. Yangi kelgan kitoblar (New Arrivals)
 */

exports.getNewArrivals = async (req, res, next) => {
  try {
    const products = await Product.find()
      .sort('-createdAt')
      .limit(8)
      .populate('author')
      .populate('publisher');
    const hydratedProducts = await hydrateProductRelations(products);
    const wishlistSet = getWishlistSet(req);

    apiResponse(
      res,
      200,
      true,
      "Yangi kelgan kitoblar",
      hydratedProducts.map((product) => withWishlistField(product, wishlistSet)),
    );
  } catch (error) { next(error); }
};

// 4. Mahsulotni ID yoki Slug bo'yicha olish (Detailed View)

exports.getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    let query;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { _id: id };
    } else {
      query = { slug: id };
    }

    const product = await Product.findOne(query)
      .populate('category', CATEGORY_SELECT)
      .populate('author')
      .populate('publisher');
    
    if (!product) {
      return apiResponse(res, 404, false, "Mahsulot topilmadi");
    }
    
    const hydratedProduct = await hydrateProductRelations(product);
    const wishlistSet = getWishlistSet(req);

    apiResponse(res, 200, true, "Mahsulot ma'lumotlari", withWishlistField(hydratedProduct, wishlistSet));
  } catch (error) {
    console.error("Error in getProductById:", error);
    next(error);
  }
};
