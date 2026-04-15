const express = require('express');
const router = express.Router();
const reviewController = require('../../controllers/admin/reviewController');
const { protect, restrictTo } = require('../../middlewares/auth');

router.use(protect, restrictTo('admin'));

router.get('/', reviewController.getAllReviewsAdmin);
router.get('/stats', reviewController.getReviewStats);
router.patch('/:id/moderate', reviewController.moderateReview);
router.patch('/:id/reply', reviewController.replyToReview);

module.exports = router;