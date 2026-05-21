const News = require('../../models/News');
const cloudinary = require('../../config/cloudinary');
const apiResponse = require('../../utils/apiResponse');
const slugify = require('../../utils/slugify');
const { getPaginationParams, buildPagination } = require('../../utils/pagination');
const { buildSearchRegex, normalizeSearchText } = require('../../utils/searchRegex');

const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'object') return value;
  return JSON.parse(value);
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return value === true || value === 'true';
};

const parseTags = (value) => {
  if (!value) return [];
  const parsed =
    typeof value === 'string' && value.trim().startsWith('[')
      ? parseJsonField(value, [])
      : value;
  if (Array.isArray(parsed)) return parsed.filter(Boolean);
  if (typeof parsed !== 'string') return [];
  return parsed
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const ensureLocalizedRequired = (field, fieldName, res) => {
  if (!field?.uz || !field?.ru || !field?.en) {
    apiResponse(res, 400, false, `${fieldName}[uz], ${fieldName}[ru], ${fieldName}[en] majburiy`);
    return false;
  }
  return true;
};

const getAllNews = async (req, res, next) => {
  try {
    const { isActive, isFeatured } = req.query;
    const search = normalizeSearchText(req.query.search);
    const paginationParams = getPaginationParams(req.query, { limit: 20 });
    const filter = {};

    if (isActive !== undefined) filter.isActive = isActive === 'true';
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

const getNewsById = async (req, res, next) => {
  try {
    const news = await News.findById(req.params.id);

    if (!news) {
      return apiResponse(res, 404, false, 'Yangilik topilmadi');
    }

    apiResponse(res, 200, true, "Yangilik ma'lumotlari", news);
  } catch (error) {
    next(error);
  }
};

const createNews = async (req, res, next) => {
  try {
    const title = parseJsonField(req.body.title, {});
    const description = parseJsonField(req.body.description, {});

    if (!ensureLocalizedRequired(title, 'title', res)) return;
    if (!ensureLocalizedRequired(description, 'description', res)) return;

    const image = req.file?.path || req.body.image || '';
    if (!image) {
      return apiResponse(res, 400, false, 'image majburiy');
    }

    const slug = req.body.slug || slugify(title.uz);
    const exists = await News.findOne({ slug });
    if (exists) {
      return apiResponse(res, 400, false, 'Bunday slug bilan yangilik mavjud');
    }

    const news = await News.create({
      title,
      slug,
      excerpt: parseJsonField(req.body.excerpt, {}),
      description,
      image,
      tags: parseTags(req.body.tags),
      isActive: parseBoolean(req.body.isActive, true),
      isFeatured: parseBoolean(req.body.isFeatured, false),
      publishedAt: req.body.publishedAt || Date.now(),
    });

    apiResponse(res, 201, true, 'Yangilik muvaffaqiyatli yaratildi', news);
  } catch (error) {
    console.error('Yangilik yaratishda xatolik:', error);
    next(error);
  }
};

const updateNews = async (req, res, next) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return apiResponse(res, 404, false, 'Yangilik topilmadi');
    }

    const updateData = {};

    if (req.body.title) {
      const title = parseJsonField(req.body.title, {});
      if (!ensureLocalizedRequired(title, 'title', res)) return;
      updateData.title = title;
      updateData.slug = req.body.slug || slugify(title.uz);
    } else if (req.body.slug) {
      updateData.slug = req.body.slug;
    }

    if (updateData.slug) {
      const exists = await News.findOne({ slug: updateData.slug, _id: { $ne: news._id } });
      if (exists) {
        return apiResponse(res, 400, false, 'Bunday slug bilan yangilik mavjud');
      }
    }

    if (req.body.excerpt) updateData.excerpt = parseJsonField(req.body.excerpt, {});
    if (req.body.description) {
      const description = parseJsonField(req.body.description, {});
      if (!ensureLocalizedRequired(description, 'description', res)) return;
      updateData.description = description;
    }
    if (req.body.tags !== undefined) updateData.tags = parseTags(req.body.tags);
    if (req.body.isActive !== undefined) updateData.isActive = parseBoolean(req.body.isActive);
    if (req.body.isFeatured !== undefined) updateData.isFeatured = parseBoolean(req.body.isFeatured);
    if (req.body.publishedAt !== undefined) updateData.publishedAt = req.body.publishedAt;

    if (req.file) {
      if (news.image && news.image.includes('cloudinary')) {
        const publicId = news.image.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`bookstore/news/${publicId}`);
      }
      updateData.image = req.file.path;
    } else if (req.body.image) {
      updateData.image = req.body.image;
    }

    const updatedNews = await News.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true },
    );

    apiResponse(res, 200, true, 'Yangilik yangilandi', updatedNews);
  } catch (error) {
    console.error('Yangilik yangilashda xatolik:', error);
    next(error);
  }
};

const deleteNews = async (req, res, next) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return apiResponse(res, 404, false, 'Yangilik topilmadi');
    }

    if (news.image && news.image.includes('cloudinary')) {
      const publicId = news.image.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`bookstore/news/${publicId}`);
    }

    await News.findByIdAndDelete(req.params.id);

    apiResponse(res, 200, true, "Yangilik o'chirildi");
  } catch (error) {
    next(error);
  }
};

const toggleNewsStatus = async (req, res, next) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return apiResponse(res, 404, false, 'Yangilik topilmadi');
    }

    news.isActive = !news.isActive;
    await news.save();

    apiResponse(
      res,
      200,
      true,
      `Yangilik ${news.isActive ? 'faollashtirildi' : 'faolsizlashtirildi'}`,
      news,
    );
  } catch (error) {
    next(error);
  }
};

const toggleNewsFeatured = async (req, res, next) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return apiResponse(res, 404, false, 'Yangilik topilmadi');
    }

    news.isFeatured = !news.isFeatured;
    await news.save();

    apiResponse(
      res,
      200,
      true,
      `Yangilik ${news.isFeatured ? 'tanlangan' : 'oddiy'} qilindi`,
      news,
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllNews,
  getNewsById,
  createNews,
  updateNews,
  deleteNews,
  toggleNewsStatus,
  toggleNewsFeatured,
};
