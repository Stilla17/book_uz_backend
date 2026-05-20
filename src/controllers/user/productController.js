const Product = require('../../models/Product');
const Category = require('../../models/Category');
const Publisher = require('../../models/Publisher');
const apiResponse = require('../../utils/apiResponse');
const hydrateProductRelations = require('../../utils/hydrateProductRelations');
const { buildSearchPattern, buildSearchRegex } = require('../../utils/searchRegex');

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

const isObjectId = (value) => /^[0-9a-fA-F]{24}$/.test(String(value || ''));

const getLocalizedValues = (field) => {
  if (!field) return [];
  if (typeof field === 'string') return [field];

  return [field.uz, field.ru, field.en, field.name, field.title].filter(Boolean);
};

const buildNameFilters = (values) => {
  const uniqueValues = [...new Set(values.filter(Boolean))];

  return uniqueValues.map((value) => ({
    'category.name': buildSearchRegex(value, { exact: true }),
  }));
};

const findCategoryByParam = async (value) => {
  if (!value) return null;

  if (isObjectId(value)) {
    const byId = await Category.findById(value).lean();
    if (byId) return byId;
  }

  return Category.findOne({
    $or: [
      { slug: value },
      { 'title.uz': buildSearchRegex(value, { exact: true }) },
      { 'title.ru': buildSearchRegex(value, { exact: true }) },
      { 'title.en': buildSearchRegex(value, { exact: true }) },
    ],
  }).lean();
};

const findSubgenreByParam = async (value) => {
  if (!value) return null;

  const subgenreFilters = [
    { 'subgenres.slug': value },
    { 'subgenres.title.uz': buildSearchRegex(value, { exact: true }) },
    { 'subgenres.title.ru': buildSearchRegex(value, { exact: true }) },
    { 'subgenres.title.en': buildSearchRegex(value, { exact: true }) },
  ];

  if (isObjectId(value)) {
    subgenreFilters.push({ 'subgenres._id': value });
  }

  const categories = await Category.find({
    $or: subgenreFilters,
  }).lean();

  const titleRegex = new RegExp(buildSearchPattern(value, { exact: true }), 'i');

  for (const category of categories) {
    const subgenre = category.subgenres?.find((item) =>
      item.slug === value ||
      item._id?.toString() === value ||
      titleRegex.test(item.title?.uz || '') ||
      titleRegex.test(item.title?.ru || '') ||
      titleRegex.test(item.title?.en || '')
    );

    if (subgenre) return { category, subgenre };
  }

  return null;
};

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
        { "title.uz": buildSearchRegex(keyword) },
        { "title.ru": buildSearchRegex(keyword) },
        { "title.en": buildSearchRegex(keyword) },
        { "description.uz": buildSearchRegex(keyword) },
        { "description.ru": buildSearchRegex(keyword) },
        { "description.en": buildSearchRegex(keyword) },
        { "publisher.name": buildSearchRegex(keyword) },
        { "author.name": buildSearchRegex(keyword) },
        ],
      });
    }

    if (category) {
      const resolvedCategory = await findCategoryByParam(category);
      const categoryFilters = [
        { "category.id": category },
        { "category._id": category },
        { "category.name": buildSearchRegex(category) },
      ];

      if (isObjectId(category)) {
        categoryFilters.unshift({ category });
      }

      if (resolvedCategory) {
        const categoryNames = getLocalizedValues(resolvedCategory.title || resolvedCategory.name);
        categoryFilters.push(...buildNameFilters(categoryNames));

        const subgenreBookIds = (resolvedCategory.subgenres || [])
          .flatMap((subgenre) => subgenre.books || [])
          .filter(Boolean);

        if (subgenreBookIds.length) {
          categoryFilters.push({ _id: { $in: subgenreBookIds } });
        }
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
        andFilters.push({ "publisher.name": buildSearchRegex(selectedPublisher) });
      }
    }
    if (language) query.language = language;
    if (contentLanguage) query.contentLanguage = contentLanguage;

    const selectedSubgenre = subCategoryId || subgenreId || subgenre;
    if (selectedSubgenre) {
      if (isObjectId(selectedSubgenre)) {
        query.subCategoryId = selectedSubgenre;
      } else {
        const resolvedSubgenre = await findSubgenreByParam(selectedSubgenre);
        const subgenreFilters = [
          { "category.id": selectedSubgenre },
          { "category._id": selectedSubgenre },
          { "category.name": buildSearchRegex(selectedSubgenre) },
        ];

        if (resolvedSubgenre) {
          const subgenreNames = getLocalizedValues(resolvedSubgenre.subgenre.title || resolvedSubgenre.subgenre.name);
          subgenreFilters.push(...buildNameFilters(subgenreNames));

          if (resolvedSubgenre.subgenre._id) {
            subgenreFilters.push({ subCategoryId: resolvedSubgenre.subgenre._id });
          }

          if (resolvedSubgenre.subgenre.books?.length) {
            subgenreFilters.push({ _id: { $in: resolvedSubgenre.subgenre.books } });
          }
        }

        andFilters.push({ $or: subgenreFilters });
      }
    }

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
