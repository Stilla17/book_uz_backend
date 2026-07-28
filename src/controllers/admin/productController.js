const Product = require("../../models/Product");
const Category = require("../../models/Category");
const Author = require("../../models/Author");
const Publisher = require("../../models/Publisher");
const slugify = require("../../utils/slugify");
const apiResponse = require("../../utils/apiResponse");
const cloudinary = require("../../config/cloudinary");
const {
  getPaginationParams,
  buildPagination,
} = require("../../utils/pagination");
const {
  buildSearchRegex,
  normalizeSearchText,
} = require("../../utils/searchRegex");
const {
  findSubgenreByIdentifier,
  resolveCategoryId,
  resolveSubCategoryId,
} = require("../../utils/subgenreMatcher");
const { getIdString } = require("../../utils/categoryView");
const { parseMaybeJson, parseBoolean } = require("../../utils/parsing");
const { cleanBarcode } = require("../../utils/moyskladClient");
const {
  ensureMoyskladProduct,
} = require("../../services/moyskladProductLinkService");

const toTrimmedString = (value) => {
  if (Array.isArray(value)) return toTrimmedString(value[0]);
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const normalizeAuthorIds = (value) => {
  const parsedValue = parseMaybeJson(value);
  const values = Array.isArray(parsedValue) ? parsedValue : [parsedValue];

  return [
    ...new Set(
      values
        .flatMap((item) =>
          typeof item === "string" ? item.split(",") : [item],
        )
        .map(toTrimmedString)
        .filter(Boolean),
    ),
  ];
};

const normalizeIdValues = (value) => {
  const parsedValue = parseMaybeJson(value);
  const values = Array.isArray(parsedValue) ? parsedValue : [parsedValue];

  return [
    ...new Set(
      values
        .flatMap((item) =>
          typeof item === "string" ? item.split(",") : [item],
        )
        .map((item) => {
          if (item && typeof item === "object") {
            return item._id ?? item.id ?? item.value ?? item;
          }
          return item;
        })
        .map(toTrimmedString)
        .filter(Boolean),
    ),
  ];
};

const getAuthorNames = (authors) =>
  (Array.isArray(authors) ? authors : [authors])
    .map((author) => author?.name)
    .filter(Boolean)
    .join(", ");

const normalizePayload = (payload = {}) => {
  const normalized = { ...payload };

  normalized.title = parseMaybeJson(payload.title) || payload.title;
  normalized.description =
    parseMaybeJson(payload.description) || payload.description;
  normalized.publisher =
    payload.publisher ?? payload.publish ?? payload.publisherId;

  if (payload.barcode !== undefined) {
    normalized.barcode = toTrimmedString(payload.barcode);
  }

  if (payload.author !== undefined) {
    normalized.author = normalizeAuthorIds(payload.author);
  }

  if (payload.categories !== undefined) {
    normalized.categories = normalizeIdValues(payload.categories);
  }

  if (payload.subCategoryIds !== undefined) {
    normalized.subCategoryIds = normalizeIdValues(payload.subCategoryIds);
  }

  if (payload.isTop !== undefined) {
    normalized.isTop = parseBoolean(payload.isTop);
  }

  if (payload.isActive !== undefined) {
    normalized.isActive = parseBoolean(payload.isActive);
  }

  return normalized;
};

const resolvePublisherId = (payload = {}) =>
  payload.publisher ?? payload.publish ?? payload.publisherId ?? null;

const validatePublisher = async (publisherId) => {
  if (!publisherId) {
    return { publisherId: null };
  }

  const publisher = await Publisher.findById(publisherId).select("_id");
  if (!publisher) {
    return { error: "Nashriyot topilmadi" };
  }

  return { publisherId: publisher._id };
};

const findDuplicateBarcode = (barcode, excludeProductId) => {
  const normalizedBarcode = toTrimmedString(barcode);
  if (!normalizedBarcode) return null;

  const barcodeDigits = cleanBarcode(normalizedBarcode);
  const normalizedPattern = barcodeDigits
    ? `^${barcodeDigits.split("").join("\\D*")}$`
    : `^${normalizedBarcode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
  const filter = {
    barcode: { $regex: new RegExp(normalizedPattern) },
  };
  if (excludeProductId) {
    filter._id = { $ne: excludeProductId };
  }

  return Product.findOne(filter).select("_id title slug");
};

const findDuplicateSlug = (slug, excludeProductId) => {
  if (!slug) return null;

  const filter = { slug };
  if (excludeProductId) {
    filter._id = { $ne: excludeProductId };
  }

  return Product.findOne(filter).select("_id title slug");
};

const buildProductSearchFilters = async (keyword) => {
  const searchRegex = buildSearchRegex(keyword);
  const [authors, publishers] = await Promise.all([
    Author.find({ name: searchRegex }).select("_id"),
    Publisher.find({ name: searchRegex }).select("_id"),
  ]);

  const filters = [
    { barcode: keyword },
    { barcode: searchRegex },
    { "title.uz": searchRegex },
    { "title.ru": searchRegex },
    { "title.en": searchRegex },
  ];

  const authorIds = authors.map((authorItem) => authorItem._id);
  if (authorIds.length) {
    filters.push({ author: { $in: authorIds } });
  }

  const publisherIds = publishers.map((publisherItem) => publisherItem._id);
  if (publisherIds.length) {
    filters.push({ publisher: { $in: publisherIds } });
  }

  return filters;
};

const ensurePersistentSubgenreIds = async (category) => {
  if (!category?.subgenres?.length) return;

  const rawCategory = await Category.collection.findOne(
    { _id: category._id },
    { projection: { "subgenres._id": 1 } },
  );
  const hasMissingPersistedId = rawCategory?.subgenres?.some(
    (subgenre) => !subgenre?._id,
  );

  if (!hasMissingPersistedId) return;

  // Some imported categories have subgenres without persisted _id values.
  // Mongoose creates temporary ids when hydrated; saving once makes them stable
  // so Product validation can match subCategoryId on the next category read.
  category.markModified("subgenres");
  await category.save({ validateBeforeSave: false });
};

const validateCategorySubgenre = async (categoryId, subCategoryId) => {
  const category = await Category.findById(categoryId).select("subgenres");
  if (!category) {
    return { error: "Kategoriya topilmadi" };
  }

  const normalizedSubCategoryId = subCategoryId || null;

  if (!category.subgenres.length) {
    return {
      category,
      subCategoryId: null,
    };
  }

  await ensurePersistentSubgenreIds(category);

  if (!normalizedSubCategoryId) {
    return { error: "Bu kategoriya uchun subCategoryId majburiy" };
  }

  const matchedSubgenre = findSubgenreByIdentifier(
    category.subgenres,
    normalizedSubCategoryId,
  );
  if (!matchedSubgenre) {
    return { error: "Tanlangan subCategoryId bu kategoriyaga tegishli emas" };
  }

  return {
    category,
    subCategoryId: matchedSubgenre._id,
  };
};

const validateCatalogSelections = async (categoryValues, subCategoryValues) => {
  const categoryIds = normalizeIdValues(categoryValues);
  const subCategoryIds = normalizeIdValues(subCategoryValues);

  if (!categoryIds.length) {
    return { error: "Kamida bitta kategoriya tanlang" };
  }

  const categories = await Category.find({ _id: { $in: categoryIds } }).select(
    "subgenres",
  );
  if (categories.length !== categoryIds.length) {
    return { error: "Tanlangan kategoriyalardan biri topilmadi" };
  }

  const normalizedSubCategoryIds = [];
  for (const categoryId of categoryIds) {
    const category = categories.find(
      (item) => getIdString(item._id) === categoryId,
    );
    await ensurePersistentSubgenreIds(category);

    const selectedForCategory = category.subgenres.filter((subgenre) =>
      subCategoryIds.includes(getIdString(subgenre._id)),
    );
    if (category.subgenres.length && !selectedForCategory.length) {
      return {
        error: "Har bir tanlangan kategoriya uchun kamida bitta subkategoriya tanlang",
      };
    }
    normalizedSubCategoryIds.push(
      ...selectedForCategory.map((subgenre) => getIdString(subgenre._id)),
    );
  }

  if (normalizedSubCategoryIds.length !== subCategoryIds.length) {
    return {
      error: "Tanlangan subkategoriyalardan biri kategoriyalarga tegishli emas",
    };
  }

  const primaryCategory = categories.find(
    (item) => getIdString(item._id) === categoryIds[0],
  );
  const primarySubCategory = primaryCategory.subgenres.find((subgenre) =>
    normalizedSubCategoryIds.includes(getIdString(subgenre._id)),
  );

  return {
    categoryIds,
    subCategoryIds: [...new Set(normalizedSubCategoryIds)],
    primaryCategoryId: primaryCategory._id,
    primarySubCategoryId: primarySubCategory?._id || null,
  };
};

const syncBookRelations = async (
  productId,
  previousProduct = {},
  nextProduct = {},
) => {
  const previousSubCategoryIds = (
    previousProduct.subCategoryIds?.length
      ? previousProduct.subCategoryIds
      : [previousProduct.subCategoryId]
  )
    .map(getIdString)
    .filter(Boolean);
  const nextSubCategoryIds = (
    nextProduct.subCategoryIds?.length
      ? nextProduct.subCategoryIds
      : [nextProduct.subCategoryId]
  )
    .map(getIdString)
    .filter(Boolean);

  const previousAuthorIds = (Array.isArray(previousProduct.author)
    ? previousProduct.author
    : [previousProduct.author]
  )
    .map(getIdString)
    .filter(Boolean);
  const nextAuthorIds = (Array.isArray(nextProduct.author)
    ? nextProduct.author
    : [nextProduct.author]
  )
    .map(getIdString)
    .filter(Boolean);

  const previousPublisherId = getIdString(previousProduct.publisher);
  const nextPublisherId = getIdString(nextProduct.publisher);

  const updates = [];

  const removedSubCategoryIds = previousSubCategoryIds.filter(
    (subCategoryId) => !nextSubCategoryIds.includes(subCategoryId),
  );
  removedSubCategoryIds.forEach((subCategoryId) => {
    updates.push(
      Category.updateOne(
        { "subgenres._id": subCategoryId },
        { $pull: { "subgenres.$.books": productId } },
      ),
    );
  });

  nextSubCategoryIds.forEach((subCategoryId) => {
    updates.push(
      Category.updateOne(
        { "subgenres._id": subCategoryId },
        { $addToSet: { "subgenres.$.books": productId } },
      ),
    );
  });

  const removedAuthorIds = previousAuthorIds.filter(
    (authorId) => !nextAuthorIds.includes(authorId),
  );
  if (removedAuthorIds.length) {
    updates.push(
      Author.updateMany(
        { _id: { $in: removedAuthorIds } },
        { $pull: { books: productId } },
      ),
    );
  }

  if (nextAuthorIds.length) {
    updates.push(
      Author.updateMany(
        { _id: { $in: nextAuthorIds } },
        { $addToSet: { books: productId } },
      ),
    );
  }

  if (previousPublisherId && previousPublisherId !== nextPublisherId) {
    updates.push(
      Publisher.updateOne(
        { _id: previousPublisherId },
        { $pull: { books: productId } },
      ),
    );
  }

  if (nextPublisherId) {
    updates.push(
      Publisher.updateOne(
        { _id: nextPublisherId },
        { $addToSet: { books: productId } },
      ),
    );
  }

  await Promise.all(updates);
};

/**
 * 0. Barcha mahsulotlarni olish (Pagination va Search bilan)
 */

const getAllProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      author,
      publisher,
      publish,
      barcode,
      subCategoryId,
      subgenreId,
      subgenre,
    } = req.query;
    const paginationParams = getPaginationParams(req.query);
    let filter = {};
    const searchKeyword = toTrimmedString(search);
    const barcodeValue = toTrimmedString(barcode);

    if (searchKeyword) {
      filter.$or = await buildProductSearchFilters(searchKeyword);
    }

    if (barcodeValue) {
      filter.barcode = barcodeValue;
    }

    if (category) {
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ category }, { categories: category }] },
      ];
    }

    if (author) {
      filter.author = author;
    }

    if (publisher || publish) {
      filter.publisher = publisher || publish;
    }

    const selectedSubgenre = subCategoryId || subgenreId || subgenre;
    if (selectedSubgenre) {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { subCategoryId: selectedSubgenre },
            { subCategoryIds: selectedSubgenre },
          ],
        },
      ];
    }

    const products = await Product.find(filter)
      .populate("category", "title name subgenres")
      .populate("author", "name")
      .populate("publisher", "name slug image")
      .sort("-createdAt")
      .skip(paginationParams.skip)
      .limit(paginationParams.limit);

    const total = await Product.countDocuments(filter);

    const productsWithDetails = products.map((product) => ({
      ...product.toObject(),
      categoryName:
        product.category?.title?.uz || product.category?.name?.uz || "Noma'lum",
      authorName: getAuthorNames(product.author) || "Noma'lum",
      publisherName: product.publisher?.name || "Noma'lum",
    }));

    apiResponse(res, 200, true, "Mahsulotlar ro'yxati", {
      products: productsWithDetails,
      pagination: buildPagination({ ...paginationParams, total }),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 1. Yangi mahsulot qo'shish (Murakkab mantiq bilan)
 */

const createProduct = async (req, res, next) => {
  try {
    const payload = normalizePayload(req.body);
    const { title, price, discountPrice, stock } = payload;

    if (!title?.uz || !title?.ru || !title?.en) {
      return apiResponse(
        res,
        400,
        false,
        "title[uz], title[ru], title[en] majburiy",
      );
    }
    if (price === undefined || price === null) {
      return apiResponse(res, 400, false, "price majburiy");
    }
    const categoryValues = payload.categories?.length
      ? payload.categories
      : [resolveCategoryId(payload)].filter(Boolean);
    if (!categoryValues.length) {
      return apiResponse(res, 400, false, "category majburiy");
    }
    if (!payload.author?.length) {
      return apiResponse(res, 400, false, "author majburiy");
    }
    if (!payload.publisher) {
      return apiResponse(res, 400, false, "publisher majburiy");
    }
    if (!payload.barcode) {
      return apiResponse(res, 400, false, "ISBN majburiy");
    }

    const duplicateBarcode = await findDuplicateBarcode(payload.barcode);
    if (duplicateBarcode) {
      return apiResponse(
        res,
        409,
        false,
        "Bu ISBN bilan kitob bazada allaqachon mavjud",
        { productId: duplicateBarcode._id, slug: duplicateBarcode.slug },
      );
    }

    const subCategoryValues = payload.subCategoryIds?.length
      ? payload.subCategoryIds
      : [resolveSubCategoryId(payload)].filter(Boolean);
    const catalogValidation = await validateCatalogSelections(
      categoryValues,
      subCategoryValues,
    );
    if (catalogValidation.error) {
      return apiResponse(res, 400, false, catalogValidation.error);
    }

    const publisherValidation = await validatePublisher(
      resolvePublisherId(payload),
    );
    if (publisherValidation.error) {
      return apiResponse(res, 400, false, publisherValidation.error);
    }

    const slug = slugify(payload.slug || title.uz);
    if (!slug) {
      return apiResponse(
        res,
        400,
        false,
        "Slug bo'sh bo'lishi mumkin emas",
      );
    }

    const duplicateSlug = await findDuplicateSlug(slug);
    if (duplicateSlug) {
      return apiResponse(
        res,
        409,
        false,
        "Bu slug bilan kitob bazada allaqachon mavjud",
        { productId: duplicateSlug._id, slug: duplicateSlug.slug },
      );
    }

    const priceNum = Number(price);
    const discountNum = Number(discountPrice || 0);
    const stockNum = Number(stock || 0);

    if (Number.isNaN(priceNum)) {
      return apiResponse(
        res,
        400,
        false,
        "price noto‘g‘ri (number bo‘lishi kerak)",
      );
    }
    if (Number.isNaN(discountNum)) {
      return apiResponse(
        res,
        400,
        false,
        "discountPrice noto‘g‘ri (number bo‘lishi kerak)",
      );
    }
    if (Number.isNaN(stockNum)) {
      return apiResponse(
        res,
        400,
        false,
        "stock noto‘g‘ri (number bo‘lishi kerak)",
      );
    }

    const imageUrls = req.files ? req.files.map((file) => file.path) : [];

    const isDiscount = discountNum > 0 && discountNum < priceNum;

    const createData = {
      ...payload,
      category: catalogValidation.primaryCategoryId,
      categories: catalogValidation.categoryIds,
      slug,
      price: priceNum,
      discountPrice: discountNum,
      stock: stockNum,
      subCategoryId: catalogValidation.primarySubCategoryId,
      subCategoryIds: catalogValidation.subCategoryIds,
      publisher: publisherValidation.publisherId,
      images: imageUrls,
      isDiscount,
    };
    delete createData.subgenreId;
    delete createData.subgenre;
    delete createData.categoryId;
    delete createData.publish;
    delete createData.publisherId;

    const newProduct = await Product.create(createData);
    await syncBookRelations(newProduct._id, {}, newProduct);

    try {
      await ensureMoyskladProduct(newProduct);
    } catch (moyskladError) {
      console.error(
        `Yangi kitob MoySklad bilan bog'lanmadi (${newProduct._id}):`,
        moyskladError.message,
      );
    }

    apiResponse(res, 201, true, "Kitob muvaffaqiyatli qo'shildi", newProduct);
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Mahsulotni yangilash (Eski rasmlarni inobatga olgan holda)
 */

const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = normalizePayload(req.body);
    const { title, price, discountPrice } = payload;

    let product = await Product.findById(id);
    if (!product) return apiResponse(res, 404, false, "Kitob topilmadi");

    if (
      payload.barcode &&
      payload.barcode !== toTrimmedString(product.barcode)
    ) {
      const duplicateBarcode = await findDuplicateBarcode(payload.barcode, id);
      if (duplicateBarcode) {
        return apiResponse(
          res,
          409,
          false,
          "Bu ISBN bilan boshqa kitob bazada mavjud",
          { productId: duplicateBarcode._id, slug: duplicateBarcode.slug },
        );
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(payload, "author") &&
      !payload.author.length
    ) {
      return apiResponse(res, 400, false, "Kamida bitta muallif tanlang");
    }

    const updateData = { ...payload };
    const hasCategoryField =
      Object.prototype.hasOwnProperty.call(req.body, "categories") ||
      Object.prototype.hasOwnProperty.call(req.body, "category") ||
      Object.prototype.hasOwnProperty.call(req.body, "categoryId");
    const currentCategoryIds = product.categories?.length
      ? product.categories
      : [product.category];
    const nextCategoryIds = hasCategoryField
      ? payload.categories?.length
        ? payload.categories
        : [resolveCategoryId(payload)].filter(Boolean)
      : currentCategoryIds;
    const hasSubCategoryField =
      Object.prototype.hasOwnProperty.call(payload, "subCategoryIds") ||
      Object.prototype.hasOwnProperty.call(payload, "subCategoryId") ||
      Object.prototype.hasOwnProperty.call(payload, "subgenreId") ||
      Object.prototype.hasOwnProperty.call(payload, "subgenre");
    const currentSubCategoryIds = product.subCategoryIds?.length
      ? product.subCategoryIds
      : [product.subCategoryId].filter(Boolean);
    const nextSubCategoryIds = hasSubCategoryField
      ? payload.subCategoryIds?.length
        ? payload.subCategoryIds
        : [resolveSubCategoryId(payload)].filter(Boolean)
      : currentSubCategoryIds;

    const catalogValidation = await validateCatalogSelections(
      nextCategoryIds,
      nextSubCategoryIds,
    );
    if (catalogValidation.error) {
      return apiResponse(res, 400, false, catalogValidation.error);
    }

    const hasPublisherField =
      Object.prototype.hasOwnProperty.call(req.body, "publisher") ||
      Object.prototype.hasOwnProperty.call(req.body, "publish") ||
      Object.prototype.hasOwnProperty.call(req.body, "publisherId");
    const nextPublisherId = hasPublisherField
      ? resolvePublisherId(payload)
      : product.publisher;
    const publisherValidation = await validatePublisher(nextPublisherId);
    if (publisherValidation.error) {
      return apiResponse(res, 400, false, publisherValidation.error);
    }

    updateData.subCategoryId = catalogValidation.primarySubCategoryId;
    updateData.subCategoryIds = catalogValidation.subCategoryIds;
    updateData.category = catalogValidation.primaryCategoryId;
    updateData.categories = catalogValidation.categoryIds;
    updateData.publisher = publisherValidation.publisherId;
    delete updateData.subgenreId;
    delete updateData.subgenre;
    delete updateData.categoryId;
    delete updateData.publish;
    delete updateData.publisherId;

    const hasSlugField = Object.prototype.hasOwnProperty.call(req.body, "slug");
    if (hasSlugField || (title && title.uz)) {
      const nextSlug = slugify(hasSlugField ? payload.slug : title.uz);
      if (!nextSlug) {
        return apiResponse(
          res,
          400,
          false,
          "Slug bo'sh bo'lishi mumkin emas",
        );
      }

      const duplicateSlug = await findDuplicateSlug(nextSlug, id);
      if (duplicateSlug) {
        return apiResponse(
          res,
          409,
          false,
          "Bu slug bilan boshqa kitob bazada mavjud",
          { productId: duplicateSlug._id, slug: duplicateSlug.slug },
        );
      }

      updateData.slug = nextSlug;
    }

    if (price || discountPrice) {
      const currentPrice = price || product.price;
      const currentDiscount = discountPrice || product.discountPrice;
      updateData.isDiscount =
        currentDiscount > 0 && currentDiscount < currentPrice;
    }

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => file.path);
      updateData.images = [...product.images, ...newImages];
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true },
    );
    await syncBookRelations(id, product, updatedProduct);

    apiResponse(
      res,
      200,
      true,
      "Ma'lumotlar muvaffaqiyatli yangilandi",
      updatedProduct,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Mahsulot rasmini o'chirish (Cloudinary'dan ham o'chadi)
 */

const deleteProductImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { imageUrl } = req.body;

    const product = await Product.findById(id);
    if (!product) return apiResponse(res, 404, false, "Kitob topilmadi");

    // 1. Cloudinary'dan o'chirish (Public ID orqali)
    const publicId = imageUrl.split("/").pop().split(".")[0];
    await cloudinary.uploader.destroy(`bookstore/products/${publicId}`);

    // 2. Bazadan o'chirish
    product.images = product.images.filter((img) => img !== imageUrl);
    await product.save();

    apiResponse(res, 200, true, "Rasm o'chirildi", product.images);
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Mahsulotni butunlay o'chirish
 */

const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return apiResponse(res, 404, false, "Kitob topilmadi");

    if (product.images.length > 0) {
      const deletePromises = product.images.map((img) => {
        const publicId = img.split("/").pop().split(".")[0];
        return cloudinary.uploader.destroy(`bookstore/products/${publicId}`);
      });
      await Promise.all(deletePromises);
    }

    await syncBookRelations(product._id, product, {});
    await Product.findByIdAndDelete(req.params.id);
    apiResponse(res, 200, true, "Kitob bazadan butunlay o'chirildi");
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Ombordagi sonini tezkor yangilash (Quick Stock Update)
 */

const updateStock = async (req, res, next) => {
  try {
    const { stock } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { stock },
      { new: true },
    );
    apiResponse(res, 200, true, "Ombor yangilandi", { stock: product.stock });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Top-mahsulot statusini o'zgartirish (Toggle isTop)
 */

const toggleTopStatus = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    product.isTop = !product.isTop;
    await product.save();
    apiResponse(res, 200, true, `Status o'zgardi: isTop = ${product.isTop}`);
  } catch (error) {
    next(error);
  }
};

const getPublicId = (url) => {
  const parts = url.split("/");
  const fileName = parts[parts.length - 1].split(".")[0];
  const folder = parts[parts.length - 3] + "/" + parts[parts.length - 2];
  return `${folder}/${fileName}`;
};

const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category", "title name subgenres")
      .populate("author", "name")
      .populate("publisher", "name slug image");

    if (!product) {
      return apiResponse(res, 404, false, "Kitob topilmadi");
    }

    apiResponse(res, 200, true, "Kitob ma'lumotlari", product);
  } catch (error) {
    next(error);
  }
};

// Search
const searchProducts = async (req, res) => {
  try {
    const { q } = req.query; // qidiruv so'zi: barcode yoki nom

    const keyword = normalizeSearchText(q);

    if (!keyword) {
      return res
        .status(400)
        .json({ success: false, message: "Qidiruv parametri bo'sh" });
    }

    const products = await Product.find({
      $or: await buildProductSearchFilters(keyword),
    })
      .populate("category", "title name subgenres")
      .populate("author", "name")
      .populate("publisher", "name slug image");

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllProducts,
  createProduct,
  updateProduct,
  getProductById,
  deleteProduct,
  deleteProductImage,
  updateStock,
  toggleTopStatus,
  searchProducts,
};
