const express = require('express');
const router = express.Router();
const bannerController = require('../../controllers/admin/bannerController');
const { protect, restrictTo } = require('../../middlewares/auth');
const upload = require('../../middlewares/upload');


router.use(protect, restrictTo('admin'));

router.get('/', bannerController.getAllBanners);
router.get('/:id', bannerController.getBannerById);
router.post('/', upload.single('image'), bannerController.createBanner);
router.patch('/:id', upload.single('image'), bannerController.updateBanner);
router.delete('/:id', bannerController.deleteBanner);
router.patch('/:id/toggle-status', bannerController.toggleBannerStatus);
router.post('/reorder', bannerController.reorderBanners);

module.exports = router;