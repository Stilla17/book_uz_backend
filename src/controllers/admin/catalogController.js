const Catalog = require("../../models/Catalog");
const apiResponse = require("../../utils/apiResponse");

const {
  getPaginationParams,
  buildPagination,
} = require("../../utils/pagination");

const {
  uploadCatalogImageToR2,
  deleteCatalogImageFromR2,
} = require("../../services/r2ImageService");
const {
  resolveCatalogPrice,
  syncMoyskladCatalogs,
} = require("../../services/moyskladCatalogService");

const allowedCategories = new Set([
  "badiiy",
  "nobadiiy",
  "trend",
  "bolalar-adabiyoti",
]);

const deleteImageSafely = async (imageKey) => {
  if (!imageKey) return;

  try {
    await deleteCatalogImageFromR2(imageKey);
  } catch (error) {
    console.error(
      `Catalog rasmi R2'dan o'chirilmadi (${imageKey}):`,
      error.message,
    );
  }
};

const getAllCatalogs = async (req, res, next) => {
  try {
    const { category = "hammasi", isActive } = req.query;
    const paginationParams = getPaginationParams(req.query, { limit: 20 });

    const filter = {};

    if (category !== "hammasi") {
      if (!allowedCategories.has(category)) {
        return apiResponse(res, 400, false, "Noto'g'ri kategoriya");
      }
      filter.category = category;
    }

    if (isActive !== undefined) {
      if (!["true", "false"].includes(String(isActive))) {
        return apiResponse(
          res,
          400,
          false,
          "isActive true yoki false bo'lishi kerak",
        );
      }

      // Old catalog records do not have isActive; they are active by default.
      filter.isActive = isActive === "true" ? { $ne: false } : false;
    }
    const [catalogs, total] = await Promise.all([
      Catalog.find(filter)
        .sort({ createdAt: -1 })
        .skip(paginationParams.skip)
        .limit(paginationParams.limit),
      Catalog.countDocuments(filter),
    ]);

    return apiResponse(res, 200, true, "Catalog ro'yxati", {
      catalogs,
      pagination: buildPagination({
        ...paginationParams,
        total,
      }),
    });
  } catch (error) {
    next(error);
  }
};

const getActiveCatalogs = async (req, res, next) => {
  try {
    const { category = "hammasi" } = req.query;
    const paginationParams = getPaginationParams(req.query, { limit: 20 });
    const filter = { isActive: { $ne: false } };

    if (category !== "hammasi") {
      if (!allowedCategories.has(category)) {
        return apiResponse(res, 400, false, "Noto'g'ri kategoriya");
      }
      filter.category = category;
    }

    const [catalogs, total] = await Promise.all([
      Catalog.find(filter)
        .sort({ createdAt: -1 })
        .skip(paginationParams.skip)
        .limit(paginationParams.limit),
      Catalog.countDocuments(filter),
    ]);

    return apiResponse(res, 200, true, "Catalog ro'yxati", {
      catalogs,
      pagination: buildPagination({ ...paginationParams, total }),
    });
  } catch (error) {
    next(error);
  }
};

const getCatalogById = async (req, res, next) => {
  try {
    const catalog = await Catalog.findById(req.params.id);

    if (!catalog) {
      return apiResponse(res, 404, false, "Catalog elementi topilmadi");
    }

    return apiResponse(res, 200, true, "Catalog elementi", catalog);
  } catch (error) {
    next(error);
  }
};

const getActiveCatalogById = async (req, res, next) => {
  try {
    const catalog = await Catalog.findOne({
      _id: req.params.id,
      isActive: { $ne: false },
    });

    if (!catalog) {
      return apiResponse(res, 404, false, "Catalog elementi topilmadi");
    }

    return apiResponse(res, 200, true, "Catalog elementi", catalog);
  } catch (error) {
    next(error);
  }
};

const createCatalog = async (req, res, next) => {
  let uploadedImage = null;

  try {
    const category = String(req.body.category || "").trim();
    const moyskladExternalCode = String(
      req.body.moyskladExternalCode || "",
    ).trim();

    if (!moyskladExternalCode) {
      return apiResponse(res, 400, false, "Внешний код majburiy");
    }

    if (!allowedCategories.has(category)) {
      return apiResponse(res, 400, false, "Noto'g'ri kategoriya");
    }

    if (!req.file) {
      return apiResponse(res, 400, false, "Catalog rasmi majburiy");
    }

    const priceData = await resolveCatalogPrice({
      externalCode: moyskladExternalCode,
    });
    uploadedImage = await uploadCatalogImageToR2(req.file.buffer);

    const catalog = await Catalog.create({
      category,
      image: uploadedImage.url,
      imageKey: uploadedImage.key,
      ...priceData,
    });

    return apiResponse(res, 201, true, "Catalog elementi yaratildi", catalog);
  } catch (error) {
    if (uploadedImage?.key) {
      await deleteImageSafely(uploadedImage.key);
    }

    next(error);
  }
};

const updateCatalog = async (req, res, next) => {
  let newImage = null;

  try {
    const catalog = await Catalog.findById(req.params.id);

    if (!catalog) {
      return apiResponse(res, 404, false, "Catalog elementi topilmadi");
    }

    const hasCategory = req.body.category !== undefined;
    const hasExternalCode = req.body.moyskladExternalCode !== undefined;

    if (!hasExternalCode && !hasCategory && !req.file) {
      return apiResponse(
        res,
        400,
        false,
        "Yangilash uchun ma'lumot yuborilmadi",
      );
    }

    if (hasExternalCode) {
      const moyskladExternalCode = String(
        req.body.moyskladExternalCode || "",
      ).trim();

      if (!moyskladExternalCode) {
        return apiResponse(res, 400, false, "Внешний код majburiy");
      }

      const priceData = await resolveCatalogPrice({
        externalCode: moyskladExternalCode,
        moyskladId:
          moyskladExternalCode === catalog.moyskladExternalCode
            ? catalog.moyskladId
            : undefined,
      });

      Object.assign(catalog, priceData);
      catalog.priceSyncError = undefined;
    }

    if (hasCategory) {
      const category = String(req.body.category).trim();

      if (!allowedCategories.has(category)) {
        return apiResponse(res, 400, false, "Noto'g'ri kategoriya");
      }

      catalog.category = category;
    }

    const oldImageKey = catalog.imageKey;

    if (req.file) {
      newImage = await uploadCatalogImageToR2(req.file.buffer);

      catalog.image = newImage.url;
      catalog.imageKey = newImage.key;
    }

    await catalog.save();

    if (newImage && oldImageKey !== newImage.key) {
      await deleteImageSafely(oldImageKey);
    }

    return apiResponse(res, 200, true, "Catalog elementi yangilandi", catalog);
  } catch (error) {
    if (newImage?.key) {
      await deleteImageSafely(newImage.key);
    }

    next(error);
  }
};

const deleteCatalog = async (req, res, next) => {
  try {
    const catalog = await Catalog.findByIdAndDelete(req.params.id);

    if (!catalog) {
      return apiResponse(res, 404, false, "Catalog elementi topilmadi");
    }

    await deleteImageSafely(catalog.imageKey);

    return apiResponse(res, 200, true, "Catalog elementi o'chirildi");
  } catch (error) {
    next(error);
  }
};

const toggleCatalogStatus = async (req, res, next) => {
  try {
    const catalog = await Catalog.findById(req.params.id);

    if (!catalog) {
      return apiResponse(res, 404, false, "Catalog elementi topilmadi");
    }

    catalog.isActive = catalog.isActive === false;
    await catalog.save();

    return apiResponse(
      res,
      200,
      true,
      `Catalog elementi ${catalog.isActive ? "faollashtirildi" : "faolsizlashtirildi"}`,
      catalog,
    );
  } catch (error) {
    next(error);
  }
};

const syncCatalogPrices = async (req, res, next) => {
  try {
    const result = await syncMoyskladCatalogs();

    return apiResponse(
      res,
      200,
      true,
      "Catalog narxlari MoySklad bilan sinxronlandi",
      result,
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllCatalogs,
  getActiveCatalogs,
  getCatalogById,
  getActiveCatalogById,
  createCatalog,
  updateCatalog,
  deleteCatalog,
  toggleCatalogStatus,
  syncCatalogPrices,
};
