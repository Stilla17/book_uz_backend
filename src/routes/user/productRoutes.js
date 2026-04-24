const express = require('express');
const router = express.Router();
const productController = require('../../controllers/user/productController');
const { optionalProtect } = require('../../middlewares/auth');

// 1. Asosiy ro'yxat (Hamma filtrlar shu yerda ishlaydi)
router.get('/', optionalProtect, productController.getAllProducts);

// 2. Yangi kelganlar (Asosiy sahifa uchun)
router.get('/new-arrivals', optionalProtect, productController.getNewArrivals);

// 3. Bitta mahsulot tafsiloti
router.get('/:id', optionalProtect, productController.getProductById);

// 4. O'xshash kitoblar (Kitob ichiga kirganda pastida chiqishi uchun)
router.get('/:id/related', optionalProtect, productController.getRelatedProducts);

module.exports = router;
