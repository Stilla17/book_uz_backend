const Author = require('../../models/Author');
const Product = require('../../models/Product');
const slugify = require('../../utils/slugify');
const apiResponse = require('../../utils/apiResponse');

const parseMaybeJson = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  return value;
};

/**
 * 1. Yangi muallif qo'shish
 */

const createAuthor = async (req, res, next) => {
  try {
    const { name, birthDate, deathDate } = req.body;
    const bio = parseMaybeJson(req.body.bio);
    
    const slug = slugify(name);
    const image = req.file ? req.file.path : '';

    const author = await Author.create({
      name,
      slug,
      bio,
      image,
      birthDate: birthDate || undefined,
      deathDate: deathDate || undefined
    });

    apiResponse(res, 201, true, "Muallif muvaffaqiyatli qo'shildi", author);
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Mualliflar ro'yxati (Pagination va Search bilan)
 * MUHIM: Har bir muallif uchun kitoblar sonini qo'shish
 */

const getAllAuthorsAdmin = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    let filter = {};

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    
    const authors = await Author.find(filter)
      .sort('name')
      .skip(skip)
      .limit(Number(limit));


    const authorsWithBookCount = await Promise.all(
      authors.map(async (author) => {
        const bookCount = await Product.countDocuments({ author: author._id });
        return {
          ...author.toObject(),
          booksCount: bookCount
        };
      })
    );

    const total = await Author.countDocuments(filter);

    apiResponse(res, 200, true, "Mualliflar ro'yxati", {
      authors: authorsWithBookCount,
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Muallif ma'lumotlarini yangilash
 */

const updateAuthor = async (req, res, next) => {
  try {
    const { name } = req.body;
    const updateData = { ...req.body };
    const parsedBio = parseMaybeJson(req.body.bio);

    if (name) {
      updateData.slug = slugify(name);
    }

    if (parsedBio !== undefined) {
      updateData.bio = parsedBio;
    }

    if (req.file) {
      updateData.image = req.file.path;
    }

    const author = await Author.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    if (!author) return apiResponse(res, 404, false, "Muallif topilmadi");

    apiResponse(res, 200, true, "Muallif ma'lumotlari yangilandi", author);
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Muallifni o'chirish
 */

const deleteAuthor = async (req, res, next) => {
  try {
    const authorId = req.params.id;

    const hasProducts = await Product.findOne({ author: authorId });
    if (hasProducts) {
      return apiResponse(res, 400, false, "Bu muallifni o'chira olmaysiz, chunki uning kitoblari bazada mavjud");
    }

    const author = await Author.findByIdAndDelete(authorId);
    if (!author) return apiResponse(res, 404, false, "Muallif topilmadi");

    apiResponse(res, 200, true, "Muallif o'chirildi");
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Muallifning batafsil statistikasi
 * MUHIM: Kitoblar sonini ham qo'shish
 */

const getAuthorDetailsAdmin = async (req, res, next) => {
  try {
    const author = await Author.findById(req.params.id);
    if (!author) return apiResponse(res, 404, false, "Muallif topilmadi");

    const products = await Product.find({ author: author._id })
      .select('title slug images price discountPrice stock ratingAvg category subCategoryId publisher')
      .populate('category', 'title subgenres')
      .populate('publisher', 'name slug image');

    apiResponse(res, 200, true, "Muallif statistikasi", {
      author: {
        ...author.toObject(),
        books: products,
        booksCount: products.length
      },
      booksCount: products.length,
      products
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { 
  createAuthor, 
  getAllAuthorsAdmin, 
  updateAuthor, 
  deleteAuthor,
  getAuthorDetailsAdmin
};
