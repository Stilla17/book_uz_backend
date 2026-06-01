const Banner = require("../../models/Banner");
const cloudinary = require("../../config/cloudinary");
const apiResponse = require("../../utils/apiResponse");
const { getPaginationParams, buildPagination } = require("../../utils/pagination");

const getAllBanners = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const paginationParams = getPaginationParams(req.query, { limit: 20 });
    const filter = {};

    if (isActive !== undefined) filter.isActive = isActive === "true";

    const [banners, total] = await Promise.all([
      Banner.find(filter)
        .sort({ order: 1, createdAt: -1 })
        .skip(paginationParams.skip)
        .limit(paginationParams.limit),
      Banner.countDocuments(filter),
    ]);

    apiResponse(res, 200, true, "Bannerlar ro'yxati", {
      banners,
      pagination: buildPagination({ ...paginationParams, total }),
    });
  } catch (error) {
    next(error);
  }
};

const getBannerById = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return apiResponse(res, 404, false, "Banner topilmadi");
    }

    apiResponse(res, 200, true, "Banner ma'lumotlari", banner);
  } catch (error) {
    next(error);
  }
};

const createBanner = async (req, res, next) => {
  try {
    const imageUrl = req.file?.path || req.body.imageUrl;
    const { name, link, order, isActive } = req.body;

    if (!name || !imageUrl) {
      return apiResponse(res, 400, false, "Banner nomi va rasmi majburiy");
    }

    const banner = await Banner.create({
      name,
      imageUrl,
      link,
      order,
      isActive,
    });

    apiResponse(res, 201, true, "Banner muvaffaqiyatli yaratildi", banner);
  } catch (error) {
    next(error);
  }
};

const updateBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return apiResponse(res, 404, false, "Banner topilmadi");
    }

    const updateData = {};
    const allowedFields = ["name", "link", "order", "isActive", "imageUrl"];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    if (req.file) {
      if (banner.imageUrl && banner.imageUrl.includes("cloudinary")) {
        const publicId = banner.imageUrl.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`banners/${publicId}`);
      }

      updateData.imageUrl = req.file.path;
    }

    const updatedBanner = await Banner.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    apiResponse(res, 200, true, "Banner yangilandi", updatedBanner);
  } catch (error) {
    next(error);
  }
};

const deleteBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return apiResponse(res, 404, false, "Banner topilmadi");
    }

    if (banner.imageUrl && banner.imageUrl.includes("cloudinary")) {
      const publicId = banner.imageUrl.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`banners/${publicId}`);
    }

    await Banner.findByIdAndDelete(req.params.id);

    apiResponse(res, 200, true, "Banner o'chirildi");
  } catch (error) {
    next(error);
  }
};

const toggleBannerStatus = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return apiResponse(res, 404, false, "Banner topilmadi");
    }

    banner.isActive = !banner.isActive;
    await banner.save();

    apiResponse(
      res,
      200,
      true,
      `Banner ${banner.isActive ? "faollashtirildi" : "faolsizlashtirildi"}`,
      banner
    );
  } catch (error) {
    next(error);
  }
};

const reorderBanners = async (req, res, next) => {
  try {
    const { banners } = req.body;

    if (!Array.isArray(banners)) {
      return apiResponse(res, 400, false, "banners array bo'lishi kerak");
    }

    await Promise.all(
      banners.map(({ id, order }) => Banner.findByIdAndUpdate(id, { order }))
    );

    apiResponse(res, 200, true, "Bannerlar tartibi yangilandi");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus,
  reorderBanners,
};
