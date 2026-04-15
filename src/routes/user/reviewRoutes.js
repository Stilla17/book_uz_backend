const express = require('express');
const router = express.Router();
const reviewController = require('../../controllers/user/reviewController');
const { protect } = require('../../middlewares/auth');
const upload = require('../../middlewares/upload'); 


router.use(protect);

// POST /api/v1/reviews - Yangi sharh qoldirish (rasmlar bilan)
router.post(
  '/', 
  upload.array('images', 3),
  reviewController.addReview
);

// PUT /api/v1/reviews/:id - Sharhni tahrirlash
router.put('/:id', reviewController.updateMyReview);

// DELETE /api/v1/reviews/:id - Sharhni o'chirish
router.delete('/:id', reviewController.deleteMyReview);

module.exports = router;