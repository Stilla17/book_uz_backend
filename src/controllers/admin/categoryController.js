const Category = require("../../models/Category");
const Product = require("../../models/Product");
const slugify = require("../../utils/slugify");
const apiResponse = require("../../utils/apiResponse");
const {
  getPaginationParams,
  buildPagination,
} = require("../../utils/pagination");
const { buildSearchRegex, normalizeSearchText } = require("../../utils/searchRegex");
const {
  getCategoryName,
  getSubgenreName,
  getCategorySubgenres,
} = require("../../utils/categoryView");
const { parseMaybeJson, parseBoolean } = require("../../utils/parsing");

const getPayload = (req) => req.body || {};

const normalizeCategoryTitle = (payload) => {
  return parseMaybeJson(payload.title || payload.name);
};

const normalizeSubgenres = (payload, category = null) => {
  const rawSubgenres = parseMaybeJson(payload.subgenres);
  if (!Array.isArray(rawSubgenres)) return undefined;

  return rawSubgenres.map((subgenre, index) => {
    const title = subgenre.title || subgenre.name;
    const candidateSlug = subgenre.slug || slugify(title?.uz || "");
    const existingSubgenre = subgenre._id
      ? category?.subgenres.id(subgenre._id)
      : category?.subgenres.find((item) => item.slug === candidateSlug);
    const slug = subgenre.slug || existingSubgenre?.slug || candidateSlug;
    const parsedBooks = parseMaybeJson(subgenre.books);
    const books = Array.isArray(parsedBooks)
      ? parsedBooks
      : existingSubgenre?.books || [];

    const normalized = {
      slug,
      title: title || existingSubgenre?.title,
      books,
      order: Number(subgenre.order ?? existingSubgenre?.order ?? index),
      isActive:
        subgenre.isActive === undefined
          ? existingSubgenre?.isActive !== false
          : parseBoolean(subgenre.isActive),
    };

    if (subgenre._id || existingSubgenre?._id) {
      normalized._id = subgenre._id || existingSubgenre._id;
    }

    return normalized;
  });
};

/**
 * 1. Asosiy kategoriya yaratish (ikkala rasm bilan)
 */

const createCategory = async (req, res, next) => {
  try {
    const payload = getPayload(req);
    const { description, order, isActive, isFeatured } = payload;
    const titleObj = normalizeCategoryTitle(payload);

    if (!Object.keys(payload).length && !req.files) {
      return apiResponse(
        res,
        400,
        false,
        "Body bo'sh yuborildi. Postman'da Body -> form-data tanlang.",
      );
    }

    if (!titleObj?.uz || !titleObj?.ru || !titleObj?.en) {
      return apiResponse(
        res,
        400,
        false,
        "title[uz], title[ru], title[en] majburiy",
      );
    }

    const slug = payload.slug || slugify(titleObj.uz);

    let descriptionObj = {};
    if (description) {
      descriptionObj = parseMaybeJson(description);
    }

    let iconUrl = "";
    let imageUrl = "";

    if (req.files) {
      if (req.files.icon && req.files.icon.length > 0) {
        iconUrl = req.files.icon[0].path;
      }
      if (req.files.image && req.files.image.length > 0) {
        imageUrl = req.files.image[0].path;
      }
    }

    const categoryData = {
      title: titleObj,
      slug,
      subgenres: normalizeSubgenres(payload) || [],
      description: descriptionObj,
      icon: iconUrl,
      image: imageUrl,
      order: Number(order || 0),
      isActive: parseBoolean(isActive),
      isFeatured: parseBoolean(isFeatured),
    };

    const category = await Category.create(categoryData);

    apiResponse(
      res,
      201,
      true,
      "Kategoriya muvaffaqiyatli yaratildi",
      category,
    );
  } catch (error) {
    console.error("Kategoriya yaratishda xatolik:", error);
    next(error);
  }
};

/**
 * 2. Sub-kategoriya qo'shish
 */

const addSubCategory = async (req, res, next) => {
  try {
    const payload = getPayload(req);
    const { categoryId } = payload;

    const titleObj = normalizeCategoryTitle(payload);
    if (!Object.keys(payload).length) {
      return apiResponse(
        res,
        400,
        false,
        "Body bo'sh yuborildi. Postman'da Body -> raw -> JSON yuboring.",
      );
    }

    if (!titleObj?.uz || !titleObj?.ru || !titleObj?.en) {
      return apiResponse(
        res,
        400,
        false,
        "title[uz], title[ru], title[en] majburiy",
      );
    }

    const slug = payload.slug || slugify(titleObj.uz);

    const category = await Category.findById(categoryId);
    if (!category)
      return apiResponse(res, 404, false, "Asosiy kategoriya topilmadi");

    const isExist = category.subgenres.find((sub) => sub.slug === slug);
    if (isExist)
      return apiResponse(
        res,
        400,
        false,
        "Bunday sub-kategoriya allaqachon mavjud",
      );

    const books = Array.isArray(payload.books)
      ? payload.books
      : parseMaybeJson(payload.books) || [];

    category.subgenres.push({
      title: titleObj,
      slug,
      books,
      order: Number(payload.order ?? category.subgenres.length),
      isActive:
        payload.isActive === undefined
          ? true
          : parseBoolean(payload.isActive),
    });
    await category.save();

    apiResponse(res, 200, true, "Sub-kategoriya qo'shildi", category);
  } catch (error) {
    console.error("Sub-kategoriya qo'shishda xatolik:", error);
    next(error);
  }
};

/**
 * 3. Kategoriyani tahrirlash (ikkala rasm bilan)
 */

const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = getPayload(req);
    const { description, order, isActive, isFeatured } = payload;

    const category = await Category.findById(id);
    if (!category) {
      return apiResponse(res, 404, false, "Kategoriya topilmadi");
    }

    const updateData = {};

    const titleObj = normalizeCategoryTitle(payload);
    if (titleObj) {
      updateData.title = titleObj;
      updateData.slug = payload.slug || slugify(titleObj.uz);
    }

    if (description) {
      updateData.description = parseMaybeJson(description);
    }

    const subgenres = normalizeSubgenres(payload, category);
    if (subgenres) updateData.subgenres = subgenres;

    if (order !== undefined) updateData.order = Number(order);
    if (isActive !== undefined)
      updateData.isActive = parseBoolean(isActive);
    if (isFeatured !== undefined)
      updateData.isFeatured = parseBoolean(isFeatured);

    if (req.files) {
      if (req.files.icon && req.files.icon.length > 0) {
        updateData.icon = req.files.icon[0].path;
      }
      if (req.files.image && req.files.image.length > 0) {
        updateData.image = req.files.image[0].path;
      }
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true },
    );

    apiResponse(res, 200, true, "Kategoriya yangilandi", updatedCategory);
  } catch (error) {
    console.error("Kategoriya yangilashda xatolik:", error);
    next(error);
  }
};

/**
 * 4. Kategoriyani o'chirish
 */

const deleteCategory = async (req, res, next) => {
  try {
    const categoryId = req.params.id;

    const hasProducts = await Product.findOne({ category: categoryId });
    if (hasProducts) {
      return apiResponse(
        res,
        400,
        false,
        "Kategoriyani o'chira olmaysiz, chunki unga bog'langan mahsulotlar mavjud!",
      );
    }

    const category = await Category.findByIdAndDelete(categoryId);
    if (!category) return apiResponse(res, 404, false, "Kategoriya topilmadi");

    apiResponse(res, 200, true, "Kategoriya muvaffaqiyatli o'chirildi");
  } catch (error) {
    console.error("Kategoriya o'chirishda xatolik:", error);
    next(error);
  }
};

/**
 * 5. Sub-kategoriyani o'chirish
 */

const deleteSubCategory = async (req, res, next) => {
  try {
    const { categoryId, subId } = req.params;

    const hasProducts = await Product.findOne({ subCategoryId: subId });
    if (hasProducts) {
      return apiResponse(
        res,
        400,
        false,
        "Sub-kategoriyada mahsulotlar bor, o'chirib bo'lmaydi",
      );
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return apiResponse(res, 404, false, "Kategoriya topilmadi");
    }

    category.subgenres = category.subgenres.filter(
      (sub) => sub._id.toString() !== subId,
    );
    await category.save();

    apiResponse(res, 200, true, "Sub-kategoriya o'chirildi");
  } catch (error) {
    console.error("Sub-kategoriya o'chirishda xatolik:", error);
    next(error);
  }
};

/**
 * 6. Barcha kategoriyalar (Admin uchun)
 */

const getAllCategoriesAdmin = async (req, res, next) => {
  try {
    const search = normalizeSearchText(req.query.search);
    const paginationParams = getPaginationParams(req.query);
    const filter = {};

    if (search) {
      const searchRegex = buildSearchRegex(search);
      filter.$or = [
        { slug: searchRegex },
        { "title.uz": searchRegex },
        { "title.ru": searchRegex },
        { "title.en": searchRegex },
        { "name.uz": searchRegex },
        { "name.ru": searchRegex },
        { "name.en": searchRegex },
        { "subgenres.slug": searchRegex },
        { "subgenres.title.uz": searchRegex },
        { "subgenres.title.ru": searchRegex },
        { "subgenres.title.en": searchRegex },
        { "subgenres.name.uz": searchRegex },
        { "subgenres.name.ru": searchRegex },
        { "subgenres.name.en": searchRegex },
      ];
    }

    const [categories, total] = await Promise.all([
      Category.find(filter)
        .sort({ order: 1, createdAt: -1 })
        .skip(paginationParams.skip)
        .limit(paginationParams.limit)
        .lean(),
      Category.countDocuments(filter),
    ]);

    const categoriesWithCount = await Promise.all(
      categories
        .filter((category) => category._id)
        .map(async (category) => {
          const subgenres = getCategorySubgenres(category)
            .filter(Boolean)
            .map((subgenre) => {
              const books = Array.isArray(subgenre.books) ? subgenre.books : [];
              return {
                ...subgenre,
                name: getSubgenreName(subgenre),
                bookCount: books.length,
              };
            });

          let categoryBookCount = subgenres.length
            ? subgenres.reduce((sum, sg) => sum + sg.bookCount, 0)
            : 0;

          if (!subgenres.length) {
            categoryBookCount = await Product.countDocuments({
              category: category._id,
            });
          }

          return {
            ...category,
            name: getCategoryName(category),
            bookCount: categoryBookCount,
            subgenres,
            subcategories: subgenres,
          };
        }),
    );

    apiResponse(res, 200, true, "Kategoriyalar ro'yxati", {
      categories: categoriesWithCount,
      pagination: buildPagination({ ...paginationParams, total }),
    });
  } catch (error) {
    console.error("Kategoriyalarni yuklashda xatolik:", error);
    next(error);
  }
};

/**
 * 7. Kategoriya holatini o'zgartirish
 */

const toggleCategoryStatus = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return apiResponse(res, 404, false, "Kategoriya topilmadi");
    }

    category.isActive = !category.isActive;
    await category.save();

    apiResponse(
      res,
      200,
      true,
      `Kategoriya ${category.isActive ? "faollashtirildi" : "faolsizlashtirildi"}`,
      category,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 8. Kategoriyani tanlangan qilish
 */

const toggleCategoryFeatured = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return apiResponse(res, 404, false, "Kategoriya topilmadi");
    }

    category.isFeatured = !category.isFeatured;
    await category.save();

    apiResponse(
      res,
      200,
      true,
      `Kategoriya ${category.isFeatured ? "tanlangan" : "oddiy"} qilindi`,
      category,
    );
  } catch (error) {
    next(error);
  }
};

const getCategoryById = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id).lean();

    if (!category) {
      return apiResponse(res, 404, false, "Kategoriya topilmadi");
    }

    apiResponse(res, 200, true, "Kategoriya topildi", {
      ...category,
      name: getCategoryName(category),
      subgenres: getCategorySubgenres(category),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCategory,
  addSubCategory,
  updateCategory,
  deleteCategory,
  deleteSubCategory,
  getAllCategoriesAdmin,
  toggleCategoryStatus,
  toggleCategoryFeatured,
  getCategoryById,
};
