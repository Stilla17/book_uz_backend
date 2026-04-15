const express = require('express');
const router = express.Router();
const productController = require('../../controllers/user/productController');

// 1. Asosiy ro'yxat (Hamma filtrlar shu yerda ishlaydi)
router.get('/', productController.getAllProducts);

// 2. Yangi kelganlar (Asosiy sahifa uchun)
router.get('/new-arrivals', productController.getNewArrivals);

// 3. Bitta mahsulot tafsiloti
router.get('/:id', productController.getProductById);

// 4. O'xshash kitoblar (Kitob ichiga kirganda pastida chiqishi uchun)
router.get('/:id/related', productController.getRelatedProducts);

module.exports = router;