const Product = require("../../models/Product");
const Category = require("../../models/Category");
const Author = require("../../models/Author");
const Publisher = require("../../models/Publisher");
const slugify = require("../../utils/slugify");
const apiResponse = require("../../utils/apiResponse");
const cloudinary = require("../../config/cloudinary");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toTrimmedString = (value) => {
  if (Array.isArray(value)) return toTrimmedString(value[0]);
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const parseMaybeJson = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  return value;
};

const normalizePayload = (payload = {}) => {
  const normalized = { ...payload };

  normalized.title = parseMaybeJson(payload.title) || payload.title;
  normalized.description =
    parseMaybeJson(payload.description) || payload.description;
  normalized.publisher =
    payload.publisher ?? payload.publish ?? payload.publisherId;

  if (payload.isTop !== undefined) {
    normalized.isTop = payload.isTop === "true" || payload.isTop === true;
  }

  return normalized;
};

const resolveSubCategoryId = (payload = {}) =>
  payload.subCategoryId ?? payload.subgenreId ?? payload.subgenre ?? null;

const resolvePublisherId = (payload = {}) =>
  payload.publisher ?? payload.publish ?? payload.publisherId ?? null;

const getIdString = (value) => {
  if (!value) return null;
  if (value._id) return value._id.toString();
  return value.toString();
};

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

  if (!normalizedSubCategoryId) {
    return { error: "Bu kategoriya uchun subCategoryId majburiy" };
  }

  const matchedSubgenre = category.subgenres.id(normalizedSubCategoryId);
  if (!matchedSubgenre) {
    return { error: "Tanlangan subCategoryId bu kategoriyaga tegishli emas" };
  }

  return {
    category,
    subCategoryId: matchedSubgenre._id,
  };
};

const syncBookRelations = async (
  productId,
  previousProduct = {},
  nextProduct = {},
) => {
  const previousCategoryId = getIdString(previousProduct.category);
  const previousSubCategoryId = getIdString(previousProduct.subCategoryId);
  const nextCategoryId = getIdString(nextProduct.category);
  const nextSubCategoryId = getIdString(nextProduct.subCategoryId);

  const previousAuthorId = getIdString(previousProduct.author);
  const nextAuthorId = getIdString(nextProduct.author);

  const previousPublisherId = getIdString(previousProduct.publisher);
  const nextPublisherId = getIdString(nextProduct.publisher);

  const updates = [];

  if (
    previousCategoryId &&
    previousSubCategoryId &&
    (previousCategoryId !== nextCategoryId ||
      previousSubCategoryId !== nextSubCategoryId)
  ) {
    updates.push(
      Category.updateOne(
        { _id: previousCategoryId, "subgenres._id": previousSubCategoryId },
        { $pull: { "subgenres.$.books": productId } },
      ),
    );
  }

  if (nextCategoryId && nextSubCategoryId) {
    updates.push(
      Category.updateOne(
        { _id: nextCategoryId, "subgenres._id": nextSubCategoryId },
        { $addToSet: { "subgenres.$.books": productId } },
      ),
    );
  }

  if (previousAuthorId && previousAuthorId !== nextAuthorId) {
    updates.push(
      Author.updateOne(
        { _id: previousAuthorId },
        { $pull: { books: productId } },
      ),
    );
  }

  if (nextAuthorId) {
    updates.push(
      Author.updateOne(
        { _id: nextAuthorId },
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
      page = 1,
      limit = 10,
      category,
      author,
      publisher,
      publish,
      barcode,
      subCategoryId,
      subgenreId,
      subgenre,
    } = req.query;
    let filter = {};
    const searchKeyword = toTrimmedString(search);
    const barcodeValue = toTrimmedString(barcode);

    if (searchKeyword) {
      const searchRegex = {
        $regex: escapeRegex(searchKeyword),
        $options: "i",
      };
      filter.$or = [
        { barcode: searchRegex },
        { "title.uz": searchRegex },
        { "title.ru": searchRegex },
        { "title.en": searchRegex },
      ];
    }

    if (barcodeValue) {
      filter.barcode = barcodeValue;
    }

    if (category) {
      filter.category = category;
    }

    if (author) {
      filter.author = author;
    }

    if (publisher || publish) {
      filter.publisher = publisher || publish;
    }

    const selectedSubgenre = subCategoryId || subgenreId || subgenre;
    if (selectedSubgenre) {
      filter.subCategoryId = selectedSubgenre;
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(filter)
      .populate("category", "title name subgenres")
      .populate("author", "name")
      .populate("publisher", "name slug image")
      .sort("-createdAt")
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments(filter);

    const productsWithDetails = products.map((product) => ({
      ...product.toObject(),
      categoryName:
        product.category?.title?.uz || product.category?.name?.uz || "Noma'lum",
      authorName: product.author?.name || "Noma'lum",
      publisherName: product.publisher?.name || "Noma'lum",
    }));

    apiResponse(res, 200, true, "Mahsulotlar ro'yxati", {
      products: productsWithDetails,
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
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
    if (!payload.category) {
      return apiResponse(res, 400, false, "category majburiy");
    }
    if (!payload.author) {
      return apiResponse(res, 400, false, "author majburiy");
    }
    if (!payload.publisher) {
      return apiResponse(res, 400, false, "publisher majburiy");
    }

    const subCategoryId = resolveSubCategoryId(payload);
    const categoryValidation = await validateCategorySubgenre(
      payload.category,
      subCategoryId,
    );
    if (categoryValidation.error) {
      return apiResponse(res, 400, false, categoryValidation.error);
    }

    const publisherValidation = await validatePublisher(
      resolvePublisherId(payload),
    );
    if (publisherValidation.error) {
      return apiResponse(res, 400, false, publisherValidation.error);
    }

    const slug = slugify(title.uz);

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
      slug,
      price: priceNum,
      discountPrice: discountNum,
      stock: stockNum,
      subCategoryId: categoryValidation.subCategoryId,
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

    const updateData = { ...payload };
    const nextCategoryId = payload.category || product.category;
    const hasSubCategoryField =
      Object.prototype.hasOwnProperty.call(payload, "subCategoryId") ||
      Object.prototype.hasOwnProperty.call(payload, "subgenreId") ||
      Object.prototype.hasOwnProperty.call(payload, "subgenre");
    const nextSubCategoryId = hasSubCategoryField
      ? resolveSubCategoryId(payload)
      : product.subCategoryId;

    const categoryValidation = await validateCategorySubgenre(
      nextCategoryId,
      nextSubCategoryId,
    );
    if (categoryValidation.error) {
      return apiResponse(res, 400, false, categoryValidation.error);
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

    updateData.subCategoryId = categoryValidation.subCategoryId;
    updateData.publisher = publisherValidation.publisherId;
    delete updateData.subgenreId;
    delete updateData.subgenre;
    delete updateData.categoryId;
    delete updateData.publish;
    delete updateData.publisherId;

    if (title && title.uz) {
      updateData.slug = slugify(title.uz);
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

    const keyword = toTrimmedString(q);

    if (!keyword) {
      return res
        .status(400)
        .json({ success: false, message: "Qidiruv parametri bo'sh" });
    }

    const searchRegex = { $regex: escapeRegex(keyword), $options: "i" };

    // Bir vaqtning o'zida ham barcode, ham title bo'yicha qidiramiz
    const products = await Product.find({
      $or: [
        { barcode: keyword }, // To'liq mos barcode birinchi navbatda ishlaydi
        { barcode: searchRegex },
        { "title.uz": searchRegex },
        { "title.ru": searchRegex },
        { "title.en": searchRegex },
      ],
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
