const express = require('express');
const router = express.Router();
const newsController = require('../../controllers/admin/newsController');
const { protect, restrictTo } = require('../../middlewares/auth');
const upload = require('../../middlewares/upload');

router.use(protect, restrictTo('admin'));

router.get('/', newsController.getAllNews);
router.get('/:id', newsController.getNewsById);
router.post('/', upload.single('image'), newsController.createNews);
router.patch('/:id', upload.single('image'), newsController.updateNews);
router.delete('/:id', newsController.deleteNews);
router.patch('/:id/toggle-status', newsController.toggleNewsStatus);
router.patch('/:id/toggle-featured', newsController.toggleNewsFeatured);

module.exports = router;
