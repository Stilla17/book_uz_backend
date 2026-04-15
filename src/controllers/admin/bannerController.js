const Banner = require('../../models/Banner');
const Author = require('../../models/Author');
const Product = require('../../models/Product');
const cloudinary = require('../../config/cloudinary');
const apiResponse = require('../../utils/apiResponse');

const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  return JSON.parse(value);
};

/**
 * GET /api/v1/admin/banners
 * Barcha bannerlarni olish
 */

const getAllBanners = async (req, res, next) => {
  try {
    const { type, page = 1, limit = 20, isActive } = req.query;
    let filter = {};
    
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const skip = (page - 1) * limit;
    
    const banners = await Banner.find(filter)
      .sort({ type: 1, order: 1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('selectedBooks', 'title price images')
      .populate('author.authorId', 'name image')
      .populate('quote.authorId', 'name image');
    
    const total = await Banner.countDocuments(filter);
    
    apiResponse(res, 200, true, "Bannerlar ro'yxati", {
      banners,
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/banners/:id
 * Bitta bannerni olish
 */

const getBannerById = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id)
      .populate('selectedBooks', 'title price images')
      .populate('author.authorId', 'name image bio')
      .populate('quote.authorId', 'name image bio');
    
    if (!banner) {
      return apiResponse(res, 404, false, "Banner topilmadi");
    }
    
    apiResponse(res, 200, true, "Banner ma'lumotlari", banner);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/banners
 * Yangi banner yaratish
 */

const createBanner = async (req, res, next) => {
  try {
    const { type } = req.body;
    
    const imageUrl = req.file?.path || req.body.imageUrl || '';
    
    const bannerData = {
      ...req.body,
      imageUrl,
      title: parseJsonField(req.body.title, {}),
      subtitle: parseJsonField(req.body.subtitle, {}),
      description: parseJsonField(req.body.description, {}),
      buttonText: parseJsonField(req.body.buttonText, {}),
      badge: parseJsonField(req.body.badge, {}),
    };
    

    if (type === 'author' && req.body.author) {
      bannerData.author = parseJsonField(req.body.author, {});
      

      if (bannerData.author.authorId) {
        const author = await Author.findById(bannerData.author.authorId);
        if (author) {
          bannerData.author.name = author.name;
          bannerData.author.nameUz = author.name;
          bannerData.author.shortBio = author.bio;
        }
      }
    }
    

    if (type === 'quote' && req.body.quote) {
      bannerData.quote = parseJsonField(req.body.quote, {});
      
      if (bannerData.quote.authorId) {
        const author = await Author.findById(bannerData.quote.authorId);
        if (author) {
          bannerData.quote.authorName = author.name;
          bannerData.quote.authorImage = author.image;
        }
      }
    }
    

    if (req.body.selectedBooks) {
      bannerData.selectedBooks = parseJsonField(req.body.selectedBooks, []);
    }
    
    const banner = await Banner.create(bannerData);
    
    apiResponse(res, 201, true, "Banner muvaffaqiyatli yaratildi", banner);
  } catch (error) {
    console.error('Banner yaratishda xatolik:', error);
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/banners/:id
 * Bannerni yangilash
 */

const updateBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return apiResponse(res, 404, false, "Banner topilmadi");
    }
    
    const updateData = { ...req.body };
    

    if (req.body.title) updateData.title = parseJsonField(req.body.title, {});
    if (req.body.subtitle) updateData.subtitle = parseJsonField(req.body.subtitle, {});
    if (req.body.description) updateData.description = parseJsonField(req.body.description, {});
    if (req.body.buttonText) updateData.buttonText = parseJsonField(req.body.buttonText, {});
    if (req.body.badge) updateData.badge = parseJsonField(req.body.badge, {});
    

    if (req.file) {

      if (banner.imageUrl && banner.imageUrl.includes('cloudinary')) {
        const publicId = banner.imageUrl.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`banners/${publicId}`);
      }
      updateData.imageUrl = req.file.path;
    }
    
    if (!req.file && req.body.imageUrl) {
      updateData.imageUrl = req.body.imageUrl;
    }
    

    if (req.body.author) {
      updateData.author = parseJsonField(req.body.author, {});
    }
    

    if (req.body.quote) {
      updateData.quote = parseJsonField(req.body.quote, {});
    }
    
    if (req.body.selectedBooks) {
      updateData.selectedBooks = parseJsonField(req.body.selectedBooks, []);
    }
    
    const updatedBanner = await Banner.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );
    
    apiResponse(res, 200, true, "Banner yangilandi", updatedBanner);
  } catch (error) {
    console.error('Banner yangilashda xatolik:', error);
    next(error);
  }
};

/**
 * DELETE /api/v1/admin/banners/:id
 * Bannerni o'chirish
 */

const deleteBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return apiResponse(res, 404, false, "Banner topilmadi");
    }
    
    if (banner.imageUrl && banner.imageUrl.includes('cloudinary')) {
      const publicId = banner.imageUrl.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`banners/${publicId}`);
    }
    
    await Banner.findByIdAndDelete(req.params.id);
    
    apiResponse(res, 200, true, "Banner o'chirildi");
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/banners/:id/toggle-status
 * Banner holatini o'zgartirish (active/inactive)
 */

const toggleBannerStatus = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return apiResponse(res, 404, false, "Banner topilmadi");
    }
    
    banner.isActive = !banner.isActive;
    await banner.save();
    
    apiResponse(res, 200, true, `Banner ${banner.isActive ? 'faollashtirildi' : 'faolsizlashtirildi'}`, banner);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/banners/reorder
 * Bannerlar tartibini o'zgartirish
 */

const reorderBanners = async (req, res, next) => {
  try {
    const { banners } = req.body; 
    
    const updatePromises = banners.map(({ id, order }) => 
      Banner.findByIdAndUpdate(id, { order })
    );
    
    await Promise.all(updatePromises);
    
    apiResponse(res, 200, true, "Bannerlar tartibi yangilandi");
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/public/banners
 * Faol bannerlarni olish (frontend uchun)
 */

const getActiveBanners = async (req, res, next) => {
  try {
    const { type, limit = 10 } = req.query;
    let filter = { isActive: true };
    
    if (type) filter.type = type;
    
    const banners = await Banner.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .limit(Number(limit))
      .populate('selectedBooks', 'title price images slug')
      .populate('author.authorId', 'name image slug')
      .populate('quote.authorId', 'name image slug');
    
    apiResponse(res, 200, true, "Faol bannerlar", banners);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/public/banners/:id/view
 * Banner ko'rilganligini qayd etish
 */

const trackBannerView = async (req, res, next) => {
  try {
    await Banner.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    apiResponse(res, 200, true, "View tracked");
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/public/banners/:id/click
 * Banner bosilganligini qayd etish
 */

const trackBannerClick = async (req, res, next) => {
  try {
    await Banner.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } });
    apiResponse(res, 200, true, "Click tracked");
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
  getActiveBanners,
  trackBannerView,
  trackBannerClick
};
