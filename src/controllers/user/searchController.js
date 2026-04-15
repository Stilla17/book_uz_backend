const Product = require('../../models/Product');
const Category = require('../../models/Category');
const Author = require('../../models/Author');
const apiResponse = require('../../utils/apiResponse');

/**
 * Global Search Suggestions
 * Foydalanuvchi yozayotgan matn bo'yicha takliflar berish
 */
exports.getSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query; 

    if (!q || q.length < 2) {
      return apiResponse(res, 200, true, "Kamida 2 ta harf yozing", {
        products: [],
        categories: [],
        authors: []
      });
    }

    const searchRegex = new RegExp(q, 'i');

    const [products, categories, authors] = await Promise.all([
      Product.find({
        $or: [
          { "title.uz": searchRegex },
          { "title.ru": searchRegex },
          { "title.en": searchRegex }
        ]
      })
      .select('title images price slug')
      .limit(5),

      Category.find({
        $or: [
          { "title.uz": searchRegex },
          { "title.ru": searchRegex },
          { "title.en": searchRegex },
          { "name.uz": searchRegex },
          { "name.ru": searchRegex },
          { "name.en": searchRegex }
        ]
      })
      .select('title name slug')
      .limit(3),

      Author.find({
        name: searchRegex
      })
      .select('name image slug')
      .limit(3)
    ]);

    apiResponse(res, 200, true, "Qidiruv natijalari", {
      products,
      categories,
      authors,
      totalCount: products.length + categories.length + authors.length
    });
  } catch (error) {
    next(error);
  }
};
