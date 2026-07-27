const Product = require('../../models/Product');
const Category = require('../../models/Category');
const Publisher = require('../../models/Publisher');
const Author = require('../../models/Author');
const apiResponse = require('../../utils/apiResponse');
const hydrateProductRelations = require('../../utils/hydrateProductRelations');
const { applyActiveDiscountsToProducts } = require('../../utils/productDiscounts');
const { buildSearchPattern, buildSearchRegex } = require('../../utils/searchRegex');
const slugify = require('../../utils/slugify');

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

const getAuthorNames = (authors) =>
  (Array.isArray(authors) ? authors : [authors])
    .map((author) => author?.name)
    .filter(Boolean)
    .join(", ");

const withDisplayFields = (product) => {
  const productObject =
    typeof product.toObject === 'function' ? product.toObject() : product;
  const primaryCategory = Array.isArray(productObject.category)
    ? productObject.category[0]
    : productObject.category;

  return {
    ...productObject,
    author:
      Array.isArray(productObject.author) && productObject.author.length
        ? productObject.author
        : [UNKNOWN_AUTHOR],
    authorName: getAuthorNames(productObject.author) || "Noma'lum",
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

const parseList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap(parseList);
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

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

const buildRelationFilters = async (Model, values) => {
  const objectIds = values.filter(isObjectId);
  const nameValues = values.filter((value) => !isObjectId(value));
  const relationQuery = [];

  if (objectIds.length) {
    relationQuery.push({ _id: { $in: objectIds } });
  }

  if (nameValues.length) {
    relationQuery.push(
      ...nameValues.map((value) => ({
        $or: [
          { slug: value },
          { name: buildSearchRegex(value, { exact: true }) },
        ],
      })),
    );
  }

  if (!relationQuery.length) return { ids: objectIds, bookIds: [] };

  const relations = await Model.find({ $or: relationQuery }).select('_id books').lean();
  const ids = [...new Set([...objectIds, ...relations.map((item) => item._id.toString())])];
  const bookIds = [
    ...new Set(
      relations
        .flatMap((item) => item.books || [])
        .map((bookId) => bookId.toString()),
    ),
  ];

  return { ids, bookIds };
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
    
    let query = { isActive: true };

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

    const genreFilters = [];
    const categoryList = parseList(category);
    const selectedSubgenre = subCategoryId || subgenreId || subgenre;
    const subgenreList = parseList(selectedSubgenre);

    for (const categoryItem of categoryList) {
      const resolvedCategory = await findCategoryByParam(categoryItem);

      genreFilters.push(
        { "category.id": categoryItem },
        { "category._id": categoryItem },
        { "category.name": buildSearchRegex(categoryItem) },
      );

      if (isObjectId(categoryItem)) {
        genreFilters.unshift(
          { category: categoryItem },
          { categories: categoryItem },
        );
      }

      if (resolvedCategory) {
        const categoryNames = getLocalizedValues(resolvedCategory.title || resolvedCategory.name);
        genreFilters.push(...buildNameFilters(categoryNames));

        const subgenreBookIds = (resolvedCategory.subgenres || [])
          .flatMap((subgenre) => subgenre.books || [])
          .filter(Boolean);

        if (subgenreBookIds.length) {
          genreFilters.push({ _id: { $in: subgenreBookIds } });
        }
      }
    }

    for (const subgenreItem of subgenreList) {
      if (isObjectId(subgenreItem)) {
        genreFilters.push(
          { subCategoryId: subgenreItem },
          { subCategoryIds: subgenreItem },
        );
        continue;
      }

      const resolvedSubgenre = await findSubgenreByParam(subgenreItem);
      genreFilters.push(
        { "category.id": subgenreItem },
        { "category._id": subgenreItem },
        { "category.name": buildSearchRegex(subgenreItem) },
      );

      if (resolvedSubgenre) {
        const subgenreNames = getLocalizedValues(resolvedSubgenre.subgenre.title || resolvedSubgenre.subgenre.name);
        genreFilters.push(...buildNameFilters(subgenreNames));

        if (resolvedSubgenre.subgenre._id) {
          genreFilters.push(
            { subCategoryId: resolvedSubgenre.subgenre._id },
            { subCategoryIds: resolvedSubgenre.subgenre._id },
          );
        }

        if (resolvedSubgenre.subgenre.books?.length) {
          genreFilters.push({ _id: { $in: resolvedSubgenre.subgenre.books } });
        }
      }
    }

    if (genreFilters.length) {
      andFilters.push({ $or: genreFilters });
    }

    const authorList = parseList(author);
    if (authorList.length) {
      const authorFilter = await buildRelationFilters(Author, authorList);
      const authorOrFilters = [];

      if (authorFilter.ids.length) {
        authorOrFilters.push({ author: { $in: authorFilter.ids } });
      }

      if (authorFilter.bookIds.length) {
        authorOrFilters.push({ _id: { $in: authorFilter.bookIds } });
      }

      if (authorOrFilters.length) {
        andFilters.push({ $or: authorOrFilters });
      } else {
        andFilters.push({ _id: { $in: [] } });
      }
    }

    const selectedPublisher = publisher || publish;
    if (selectedPublisher) {
      const publisherList = parseList(selectedPublisher);
      const defaultPublisher = await Publisher.findOne().lean();
      const publisherCount = defaultPublisher ? await Publisher.countDocuments() : 0;
      const matchesDefaultPublisher =
        publisherList.length === 1 &&
        publisherCount === 1 &&
        defaultPublisher &&
        [
          defaultPublisher._id.toString(),
          defaultPublisher.slug,
          defaultPublisher.name,
        ].includes(publisherList[0]);

      if (matchesDefaultPublisher) {
        andFilters.push({
          $or: [
            { publisher: defaultPublisher._id },
            { publisher: { $exists: false } },
            { publisher: null },
          ],
        });
      } else {
        const publisherFilter = await buildRelationFilters(Publisher, publisherList);
        const publisherOrFilters = [];

        if (publisherFilter.ids.length) {
          publisherOrFilters.push({ publisher: { $in: publisherFilter.ids } });
        }

        if (publisherFilter.bookIds.length) {
          publisherOrFilters.push({ _id: { $in: publisherFilter.bookIds } });
        }

        if (publisherOrFilters.length) {
          andFilters.push({ $or: publisherOrFilters });
        } else {
          andFilters.push({ _id: { $in: [] } });
        }
      }
    }
    if (language) query.language = language;
    if (contentLanguage) query.contentLanguage = contentLanguage;

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
    const discountedProducts = await applyActiveDiscountsToProducts(hydratedProducts);
    const wishlistSet = getWishlistSet(req);

    apiResponse(res, 200, true, "Mahsulotlar ro'yxati", {
      products: discountedProducts.map((product) => withWishlistField(product, wishlistSet)),
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
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    });
    if (!product) return apiResponse(res, 404, false, "Mahsulot topilmadi");

    const related = await Product.find({
      isActive: true,
      category: product.category,
      ...(product.subCategoryId ? { subCategoryId: product.subCategoryId } : {}),
      _id: { $ne: product._id } 
    })
    .limit(4)
    .populate('category', CATEGORY_SELECT)
    .populate('author')
    .populate('publisher');

    const hydratedRelated = await hydrateProductRelations(related);
    const discountedRelated = await applyActiveDiscountsToProducts(hydratedRelated);
    const wishlistSet = getWishlistSet(req);

    apiResponse(
      res,
      200,
      true,
      "O'xshash mahsulotlar",
      discountedRelated.map((product) => withWishlistField(product, wishlistSet)),
    );
  } catch (error) { next(error); }
};

/**
 * 3. Yangi kelgan kitoblar (New Arrivals)
 */

exports.getNewArrivals = async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true })
      .sort('-createdAt')
      .limit(8)
      .populate('author')
      .populate('publisher');
    const hydratedProducts = await hydrateProductRelations(products);
    const discountedProducts = await applyActiveDiscountsToProducts(hydratedProducts);
    const wishlistSet = getWishlistSet(req);

    apiResponse(
      res,
      200,
      true,
      "Yangi kelgan kitoblar",
      discountedProducts.map((product) => withWishlistField(product, wishlistSet)),
    );
  } catch (error) { next(error); }
};

// 4. Mahsulotni ID yoki Slug bo'yicha olish (Detailed View)

exports.getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    let query;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { _id: id, isActive: true };
    } else {
      query = { slug: slugify(id), isActive: true };
    }

    const product = await Product.findOne(query)
      .populate('category', CATEGORY_SELECT)
      .populate('author', 'name slug image')
      .populate('publisher', 'name slug image');
    
    if (!product) {
      return apiResponse(res, 404, false, "Mahsulot topilmadi");
    }
    
    const hydratedProduct = await hydrateProductRelations(product);
    const discountedProduct = await applyActiveDiscountsToProducts(hydratedProduct);
    const wishlistSet = getWishlistSet(req);

    apiResponse(res, 200, true, "Mahsulot ma'lumotlari", withWishlistField(discountedProduct, wishlistSet));
  } catch (error) {
    console.error("Error in getProductById:", error);
    next(error);
  }
};
