const Banner = require('../../models/Banner');
const apiResponse = require('../../utils/apiResponse');

/**
 * GET /api/v1/banners
 * Faol bannerlarni olish (frontend uchun)
 */

const getActiveBanners = async (req, res, next) => {
  try {
    const { type } = req.query;
    let filter = { isActive: true };
    
    if (type) {
      filter.type = type;
    }
    
    const banners = await Banner.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .populate('selectedBooks', 'title price images slug')
      .populate('author.authorId', 'name image slug')
      .populate('quote.authorId', 'name image slug');
    
    apiResponse(res, 200, true, "Faol bannerlar", banners);
  } catch (error) {
    console.error('Error fetching banners:', error);
    next(error);
  }
};

/**
 * POST /api/v1/banners/:id/view
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
 * POST /api/v1/banners/:id/click
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
  getActiveBanners,
  trackBannerView,
  trackBannerClick
};