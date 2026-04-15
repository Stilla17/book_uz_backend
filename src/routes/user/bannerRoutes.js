const express = require('express');
const router = express.Router();
const bannerController = require('../../controllers/user/bannerController');


router.get('/', bannerController.getActiveBanners);
router.post('/:id/view', bannerController.trackBannerView);
router.post('/:id/click', bannerController.trackBannerClick);

module.exports = router;