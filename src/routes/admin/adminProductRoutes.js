const express = require('express');
const router = express.Router();
const productController = require('../../controllers/admin/productController');
const { protect, restrictTo } = require('../../middlewares/auth');
const upload = require('../../middlewares/upload'); // Rasmlar uchun

router.use(protect, restrictTo('admin'));

// GET routes - MUHIM! GET birinchi bo'lishi kerak
router.get('/', productController.getAllProducts);  // YANGI QO'SHILDI
router.get('/:id', productController.getProductById);  // YANGI QO'SHILDI (agar kerak bo'lsa)

// POST routes
router.post('/', upload.array('images', 5), productController.createProduct);

// PATCH routes
router.patch('/:id', upload.array('images', 5), productController.updateProduct);
router.patch('/:id/stock', productController.updateStock);
router.patch('/:id/toggle-top', productController.toggleTopStatus);

// DELETE routes
router.delete('/:id', productController.deleteProduct);
router.delete('/:id/image', productController.deleteProductImage);

module.exports = router;