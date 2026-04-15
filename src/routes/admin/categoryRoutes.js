const express = require('express');
const router = express.Router();
const categoryController = require('../../controllers/admin/categoryController');
const { protect, restrictTo } = require('../../middlewares/auth');
const upload = require('../../middlewares/upload');

// Multiple file upload - ikkala rasmni qabul qilish
const uploadFields = upload.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]);

router.use(protect, restrictTo('admin'));

// Asosiy kategoriyalar
router.get('/', categoryController.getAllCategoriesAdmin);
router.post('/', uploadFields, categoryController.createCategory);
router.patch('/:id', uploadFields, categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);
router.patch('/:id/toggle-status', categoryController.toggleCategoryStatus);
router.patch('/:id/toggle-featured', categoryController.toggleCategoryFeatured);

// Sub-kategoriyalar
router.post('/sub', categoryController.addSubCategory);
router.delete('/:categoryId/sub/:subId', categoryController.deleteSubCategory);

module.exports = router;