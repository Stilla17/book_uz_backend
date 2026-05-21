const News = require('../../models/News');
const apiResponse = require('../../utils/apiResponse');
const { getPaginationParams, buildPagination } = require('../../utils/pagination');
const { buildSearchRegex, normalizeSearchText } = require('../../utils/searchRegex');

const getAllNews = async (req, res, next) => {
  try {
    const { isFeatured } = req.query;
    const search = normalizeSearchText(req.query.search);
    const paginationParams = getPaginationParams(req.query, { limit: 12 });
    const filter = { isActive: true };

    if (isFeatured !== undefined) filter.isFeatured = isFeatured === 'true';

    if (search) {
      const searchRegex = buildSearchRegex(search);
      filter.$or = [
        { slug: searchRegex },
        { 'title.uz': searchRegex },
        { 'title.ru': searchRegex },
        { 'title.en': searchRegex },
        { 'excerpt.uz': searchRegex },
        { 'excerpt.ru': searchRegex },
        { 'excerpt.en': searchRegex },
        { 'description.uz': searchRegex },
        { 'description.ru': searchRegex },
        { 'description.en': searchRegex },
        { tags: searchRegex },
      ];
    }

    const [news, total] = await Promise.all([
      News.find(filter)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(paginationParams.skip)
        .limit(paginationParams.limit),
      News.countDocuments(filter),
    ]);

    apiResponse(res, 200, true, "Yangiliklar ro'yxati", {
      news,
      pagination: buildPagination({ ...paginationParams, total }),
    });
  } catch (error) {
    next(error);
  }
};

const getNewsBySlug = async (req, res, next) => {
  try {
    const news = await News.findOne({ slug: req.params.slug, isActive: true });

    if (!news) {
      return apiResponse(res, 404, false, 'Yangilik topilmadi');
    }

    apiResponse(res, 200, true, "Yangilik ma'lumotlari", news);
  } catch (error) {
    next(error);
  }
};

const trackNewsView = async (req, res, next) => {
  try {
    await News.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    apiResponse(res, 200, true, "Ko'rish qayd etildi");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllNews,
  getNewsBySlug,
  trackNewsView,
};
