const express = require('express');
const router = express.Router();
const categoryController = require('../../controllers/user/categoryController');

router.get('/', categoryController.getAllCategories);
router.get('/tree', categoryController.getCategoryTree);
router.get('/:slug', categoryController.getCategoryBySlug);
router.get('/:slug/products', categoryController.getCategoryProducts);

module.exports = router;
