const AudioBook = require('../../models/AudioBook');
const apiResponse = require('../../utils/apiResponse');

/**
 * GET /api/v1/audio-books
 * Faol audio kitoblarni olish
 */

const getActiveAudioBooks = async (req, res, next) => {
  try {
    const { limit = 10, category, hit, new: isNew } = req.query;
    let filter = { isActive: true };
    
    if (category) filter.category = category;
    if (hit === 'true') filter.isHit = true;
    if (isNew === 'true') filter.isNew = true;
    
    const audioBooks = await AudioBook.find(filter)
      .populate('category', 'title name slug')
      .sort({ isHit: -1, isNew: -1, order: 1, createdAt: -1 })
      .limit(Number(limit));
    
    return apiResponse(res, 200, true, "Audio kitoblar", audioBooks);
  } catch (error) {
    console.error('Error in getActiveAudioBooks:', error);
    next(error);
  }
};

/**
 * GET /api/v1/audio-books/:id
 * Audio kitobni ID bo'yicha olish
 * MUHIM: Funksiya nomi getAudioBookById bo'lishi kerak
 */

const getAudioBookById = async (req, res, next) => {
  try {
    const audioBook = await AudioBook.findById(req.params.id)
      .populate('category', 'title name slug');
    
    if (!audioBook || !audioBook.isActive) {
      return apiResponse(res, 404, false, "Audio kitob topilmadi");
    }
    
    audioBook.listens += 1;
    await audioBook.save();
    
    return apiResponse(res, 200, true, "Audio kitob ma'lumotlari", audioBook);
  } catch (error) {
    console.error('Error in getAudioBookById:', error);
    next(error);
  }
};

/**
 * GET /api/v1/audio-books/slug/:slug
 * Audio kitobni slug bo'yicha olish
 */

const getAudioBookBySlug = async (req, res, next) => {
  try {
    const audioBook = await AudioBook.findOne({ slug: req.params.slug, isActive: true })
      .populate('category', 'title name slug');
    
    if (!audioBook) {
      return apiResponse(res, 404, false, "Audio kitob topilmadi");
    }
    
    audioBook.listens += 1;
    await audioBook.save();
    
    return apiResponse(res, 200, true, "Audio kitob ma'lumotlari", audioBook);
  } catch (error) {
    console.error('Error in getAudioBookBySlug:', error);
    next(error);
  }
};

/**
 * POST /api/v1/audio-books/:id/download
 * Yuklab olishlar sonini oshirish
 */

const incrementDownload = async (req, res, next) => {
  try {
    const audioBook = await AudioBook.findById(req.params.id);
    if (!audioBook) {
      return apiResponse(res, 404, false, "Audio kitob topilmadi");
    }
    
    audioBook.downloads += 1;
    await audioBook.save();
    
    return apiResponse(res, 200, true, "Download hisoblandi", { downloads: audioBook.downloads });
  } catch (error) {
    console.error('Error in incrementDownload:', error);
    next(error);
  }
};

module.exports = {
  getActiveAudioBooks,
  getAudioBookById,  
  getAudioBookBySlug,
  incrementDownload
};
