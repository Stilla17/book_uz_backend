const express = require('express');
const router = express.Router();
const userCouponController = require('../../controllers/user/couponController');
const { protect } = require('../../middlewares/auth');


router.post('/apply', protect, userCouponController.applyCoupon);

module.exports = router;