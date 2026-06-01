const Banner = require("../../models/Banner");
const apiResponse = require("../../utils/apiResponse");

const getActiveBanners = async (req, res, next) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({
      order: 1,
      createdAt: -1,
    });

    apiResponse(res, 200, true, "Faol bannerlar", banners);
  } catch (error) {
    next(error);
  }
};

const trackBannerView = async (req, res, next) => {
  try {
    await Banner.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    apiResponse(res, 200, true, "View tracked");
  } catch (error) {
    next(error);
  }
};

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
  trackBannerClick,
};
