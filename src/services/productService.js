const Product = require('../models/Product');

class ProductService {
  async getAllProducts(query) {
    const { 
      category, subCategory, subCategoryId, subgenreId, subgenre, author, 
      publisher, publish,
      minPrice, maxPrice, 
      isDiscount, isTop, 
      search, sort, page = 1, limit = 10 
    } = query;

    let filter = {};

    // Filterlash mantiqi
    if (category) filter.category = category;
    if (subCategory || subCategoryId || subgenreId || subgenre) {
      filter.subCategoryId = subCategory || subCategoryId || subgenreId || subgenre;
    }
    if (author) filter.author = author;
    if (publisher || publish) filter.publisher = publisher || publish;
    if (isDiscount === 'true') filter.isDiscount = true;
    if (isTop === 'true') filter.isTop = true;
    
    // Narx bo'yicha filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Qidiruv (Title bo'yicha)
    if (search) {
      filter["title.uz"] = { $regex: search, $options: 'i' };
    }

    // Sortlash
    let sortOptions = {};
    if (sort === 'price-asc') sortOptions.price = 1;
    else if (sort === 'price-desc') sortOptions.price = -1;
    else sortOptions.createdAt = -1;

    const skip = (page - 1) * limit;
    
    const products = await Product.find(filter)
      .populate('author')
      .populate('publisher')
      .populate('category', 'title name subgenres')
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments(filter);

    return { products, total, page: Number(page), pages: Math.ceil(total / limit) };
  }
}

module.exports = new ProductService();
