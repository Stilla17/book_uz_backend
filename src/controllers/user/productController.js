const Product = require('../../models/Product');
const apiResponse = require('../../utils/apiResponse');

/**
 * 1. Murakkab qidiruv, filtr, sort va pagination bilan barcha mahsulotlarni olish
 */
exports.getAllProducts = async (req, res, next) => {
  try {
    const { keyword, category, author, publisher, publish, minPrice, maxPrice, sort, page = 1, limit = 12, subCategoryId, subgenreId, subgenre } = req.query;
    
    let query = {};


    if (keyword) {
      query.$or = [
        { "title.uz": { $regex: keyword, $options: 'i' } },
        { "title.ru": { $regex: keyword, $options: 'i' } },
        { "description.uz": { $regex: keyword, $options: 'i' } }
      ];
    }

    if (category) query.category = category;
    if (author) query.author = author;
    if (publisher || publish) query.publisher = publisher || publish;

    const selectedSubgenre = subCategoryId || subgenreId || subgenre;
    if (selectedSubgenre) query.subCategoryId = selectedSubgenre;

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let sortBy = '-createdAt';
    if (sort === 'price_asc') sortBy = 'price';
    if (sort === 'price_desc') sortBy = '-price';
    if (sort === 'rating') sortBy = '-ratingAvg';

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name title subgenres')
        .populate('author', 'name')
        .populate('publisher', 'name slug image')
        .sort(sortBy)
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(query)
    ]);

    apiResponse(res, 200, true, "Mahsulotlar ro'yxati", {
      products,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. O'xshash mahsulotlarni olish (Recommendations)
 * Bir xil kategoriya yoki muallifga tegishli kitoblarni topish
 */

exports.getRelatedProducts = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return apiResponse(res, 404, false, "Mahsulot topilmadi");

    const related = await Product.find({
      category: product.category,
      ...(product.subCategoryId ? { subCategoryId: product.subCategoryId } : {}),
      _id: { $ne: product._id } 
    })
    .limit(4)
    .populate('category', 'name title subgenres')
    .populate('author', 'name')
    .populate('publisher', 'name slug image');

    apiResponse(res, 200, true, "O'xshash mahsulotlar", related);
  } catch (error) { next(error); }
};

/**
 * 3. Yangi kelgan kitoblar (New Arrivals)
 */

exports.getNewArrivals = async (req, res, next) => {
  try {
    const products = await Product.find()
      .sort('-createdAt')
      .limit(8)
      .populate('author', 'name')
      .populate('publisher', 'name slug image');
    apiResponse(res, 200, true, "Yangi kelgan kitoblar", products);
  } catch (error) { next(error); }
};

// 4. Mahsulotni ID yoki Slug bo'yicha olish (Detailed View)

exports.getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    let query;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { _id: id };
    } else {
      query = { slug: id };
    }

    const product = await Product.findOne(query)
      .populate('category', 'title name subgenres')
      .populate('author', 'name')
      .populate('publisher', 'name slug image');
    
    if (!product) {
      return apiResponse(res, 404, false, "Mahsulot topilmadi");
    }
    
    apiResponse(res, 200, true, "Mahsulot ma'lumotlari", product);
  } catch (error) {
    console.error("Error in getProductById:", error);
    next(error);
  }
};
