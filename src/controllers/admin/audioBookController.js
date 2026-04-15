const AudioBook = require('../../models/AudioBook');
const Category = require('../../models/Category');
const slugify = require('../../utils/slugify');
const apiResponse = require('../../utils/apiResponse');
const cloudinary = require('../../config/cloudinary');

/**
 * GET /api/v1/admin/audio-books
 * Barcha audio kitoblarni olish
 */

const getAllAudioBooks = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, category, isActive, hit, new: isNew } = req.query;
    let filter = {};
    
    if (search) {
      filter.$or = [
        { 'title.uz': { $regex: search, $options: 'i' } },
        { 'title.ru': { $regex: search, $options: 'i' } },
        { 'title.en': { $regex: search, $options: 'i' } },
        { 'author.uz': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (hit === 'true') filter.isHit = true;
    if (isNew === 'true') filter.isNew = true;
    
    const skip = (page - 1) * limit;
    
    const audioBooks = await AudioBook.find(filter)
      .populate('category', 'title name slug')
      .sort({ isHit: -1, isNew: -1, order: 1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    const total = await AudioBook.countDocuments(filter);
    
    return apiResponse(res, 200, true, "Audio kitoblar ro'yxati", {
      audioBooks,
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error in getAllAudioBooks:', error);
    next(error);
  }
};

/**
 * GET /api/v1/admin/audio-books/:id
 * Bitta audio kitobni olish
 */
const getAudioBookById = async (req, res, next) => {
  try {
    const audioBook = await AudioBook.findById(req.params.id)
      .populate('category', 'title name slug');
    
    if (!audioBook) {
      return apiResponse(res, 404, false, "Audio kitob topilmadi");
    }
    
    return apiResponse(res, 200, true, "Audio kitob ma'lumotlari", audioBook);
  } catch (error) {
    console.error('Error in getAudioBookById:', error);
    next(error);
  }
};

/**
 * POST /api/v1/admin/audio-books
 * Yangi audio kitob yaratish
 */
const createAudioBook = async (req, res, next) => {
  try {
    console.log('📥 Request body:', req.body);
    console.log('📥 Request files:', req.files);
    
    const { title, author, narrator, description, duration, category, tags, isNew, isHit, order } = req.body;
    
 
    if (!title) {
      return apiResponse(res, 400, false, "title majburiy");
    }
    
    let titleObj, authorObj, narratorObj, descriptionObj, tagsObj;
    
    try {
      titleObj = typeof title === 'string' ? JSON.parse(title) : title;
      authorObj = author ? (typeof author === 'string' ? JSON.parse(author) : author) : { uz: '', ru: '', en: '' };
      narratorObj = narrator ? (typeof narrator === 'string' ? JSON.parse(narrator) : narrator) : { uz: '', ru: '', en: '' };
      descriptionObj = description ? (typeof description === 'string' ? JSON.parse(description) : description) : { uz: '', ru: '', en: '' };
      tagsObj = tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : [];
    } catch (e) {
      console.error('JSON parse error:', e);
      return apiResponse(res, 400, false, "JSON format noto'g'ri");
    }
    
    if (!titleObj.uz) {
      return apiResponse(res, 400, false, "title[uz] majburiy");
    }
    
 
    const slug = require('../../utils/slugify')(titleObj.uz);
  
    let coverImage = '';
    if (req.files && req.files.coverImage && req.files.coverImage.length > 0) {
      coverImage = req.files.coverImage[0].path;
      console.log('✅ Cover image uploaded:', coverImage);
    } else {
      return apiResponse(res, 400, false, "coverImage majburiy");
    }
    

    let audioUrl = '';
    let audioFileId = '';
    if (req.files && req.files.audioFile && req.files.audioFile.length > 0) {
      audioUrl = req.files.audioFile[0].path;
      audioFileId = req.files.audioFile[0].filename || '';
      console.log('✅ Audio file uploaded:', audioUrl);
    } else {
      console.log('⚠️ Audio file not uploaded (optional)');
    }
    
    let durationSeconds = 0;
    if (duration) {
      const durationParts = duration.split(':');
      if (durationParts.length === 2) {
        durationSeconds = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
      } else if (durationParts.length === 3) {
        durationSeconds = parseInt(durationParts[0]) * 3600 + parseInt(durationParts[1]) * 60 + parseInt(durationParts[2]);
      } else {
        durationSeconds = parseInt(durationParts[0]) * 60;
      }
    }
    
    const audioBookData = {
      title: titleObj,
      slug,
      author: authorObj,
      narrator: narratorObj,
      description: descriptionObj,
      coverImage,
      audioUrl,
      audioFileId,
      duration: duration || '0:00',
      durationSeconds,
      category: category || null,
      tags: tagsObj,
      isNew: isNew === 'true' || isNew === true,
      isHit: isHit === 'true' || isHit === true,
      order: Number(order || 0),
      isActive: true
    };
    
    console.log('📦 Creating audio book with data:', audioBookData);
    
    const audioBook = await AudioBook.create(audioBookData);
    
    return apiResponse(res, 201, true, "Audio kitob muvaffaqiyatli yaratildi", audioBook);
  } catch (error) {
    console.error('❌ Audio kitob yaratishda xatolik:', error);
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/audio-books/:id
 * Audio kitobni yangilash
 */

const updateAudioBook = async (req, res, next) => {
  try {
    const audioBook = await AudioBook.findById(req.params.id);
    if (!audioBook) {
      return apiResponse(res, 404, false, "Audio kitob topilmadi");
    }
    
    const { title, author, narrator, description, duration, category, tags, isNew, isHit, order, isActive } = req.body;
    
    const updateData = {};
    
    if (title) {
      try {
        updateData.title = typeof title === 'string' ? JSON.parse(title) : title;
        updateData.slug = require('../../utils/slugify')(updateData.title.uz);
      } catch (e) {
        return apiResponse(res, 400, false, "title JSON format noto'g'ri");
      }
    }
    
    if (author) {
      try {
        updateData.author = typeof author === 'string' ? JSON.parse(author) : author;
      } catch (e) {
        return apiResponse(res, 400, false, "author JSON format noto'g'ri");
      }
    }
    
    if (narrator) {
      try {
        updateData.narrator = typeof narrator === 'string' ? JSON.parse(narrator) : narrator;
      } catch (e) {
        return apiResponse(res, 400, false, "narrator JSON format noto'g'ri");
      }
    }
    
    if (description) {
      try {
        updateData.description = typeof description === 'string' ? JSON.parse(description) : description;
      } catch (e) {
        return apiResponse(res, 400, false, "description JSON format noto'g'ri");
      }
    }
    
    if (duration) {
      updateData.duration = duration;
      const durationParts = duration.split(':');
      if (durationParts.length === 2) {
        updateData.durationSeconds = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
      } else {
        updateData.durationSeconds = parseInt(durationParts[0]) * 60;
      }
    }
    
    if (category !== undefined) updateData.category = category || null;
    
    if (tags) {
      try {
        updateData.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (e) {
        return apiResponse(res, 400, false, "tags JSON format noto'g'ri");
      }
    }
    
    if (isNew !== undefined) updateData.isNew = isNew === 'true' || isNew === true;
    if (isHit !== undefined) updateData.isHit = isHit === 'true' || isHit === true;
    if (order !== undefined) updateData.order = Number(order);
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
    

    if (req.files && req.files.coverImage) {
      updateData.coverImage = req.files.coverImage[0].path;
    }

    if (req.files && req.files.audioFile) {
      updateData.audioUrl = req.files.audioFile[0].path;
      updateData.audioFileId = req.files.audioFile[0].filename || '';
    }
    
    const updatedAudioBook = await AudioBook.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );
    
    return apiResponse(res, 200, true, "Audio kitob yangilandi", updatedAudioBook);
  } catch (error) {
    console.error('Audio kitob yangilashda xatolik:', error);
    next(error);
  }
};

/**
 * DELETE /api/v1/admin/audio-books/:id
 * Audio kitobni o'chirish
 */

const deleteAudioBook = async (req, res, next) => {
  try {
    const audioBook = await AudioBook.findById(req.params.id);
    if (!audioBook) {
      return apiResponse(res, 404, false, "Audio kitob topilmadi");
    }
    
    await AudioBook.findByIdAndDelete(req.params.id);
    
    return apiResponse(res, 200, true, "Audio kitob o'chirildi");
  } catch (error) {
    console.error('Error in deleteAudioBook:', error);
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/audio-books/:id/toggle-status
 * Audio kitob holatini o'zgartirish
 */

const toggleAudioBookStatus = async (req, res, next) => {
  try {
    const audioBook = await AudioBook.findById(req.params.id);
    if (!audioBook) {
      return apiResponse(res, 404, false, "Audio kitob topilmadi");
    }
    
    audioBook.isActive = !audioBook.isActive;
    await audioBook.save();
    
    return apiResponse(res, 200, true, `Audio kitob ${audioBook.isActive ? 'faollashtirildi' : 'faolsizlashtirildi'}`, audioBook);
  } catch (error) {
    console.error('Error in toggleAudioBookStatus:', error);
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/audio-books/:id/toggle-hit
 * Hit statusini o'zgartirish
 */

const toggleHitStatus = async (req, res, next) => {
  try {
    const audioBook = await AudioBook.findById(req.params.id);
    if (!audioBook) {
      return apiResponse(res, 404, false, "Audio kitob topilmadi");
    }
    
    audioBook.isHit = !audioBook.isHit;
    await audioBook.save();
    
    return apiResponse(res, 200, true, `Hit status ${audioBook.isHit ? 'qo\'shildi' : 'olib tashlandi'}`, audioBook);
  } catch (error) {
    console.error('Error in toggleHitStatus:', error);
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/audio-books/:id/toggle-new
 * Yangi statusini o'zgartirish
 */

const toggleNewStatus = async (req, res, next) => {
  try {
    const audioBook = await AudioBook.findById(req.params.id);
    if (!audioBook) {
      return apiResponse(res, 404, false, "Audio kitob topilmadi");
    }
    
    audioBook.isNew = !audioBook.isNew;
    await audioBook.save();
    
    return apiResponse(res, 200, true, `Yangi status ${audioBook.isNew ? 'qo\'shildi' : 'olib tashlandi'}`, audioBook);
  } catch (error) {
    console.error('Error in toggleNewStatus:', error);
    next(error);
  }
};

module.exports = {
  getAllAudioBooks,
  getAudioBookById,
  createAudioBook,
  updateAudioBook,
  deleteAudioBook,
  toggleAudioBookStatus,
  toggleHitStatus,
  toggleNewStatus
};
