const express = require('express');
const router = express.Router();
const adminCouponController = require('../../controllers/admin/couponController');
const { protect, restrictTo } = require('../../middlewares/auth');


router.use(protect, restrictTo('ADMIN'));

router.post('/', adminCouponController.createCoupon); 
router.get('/', adminCouponController.getAllCoupons); 
router.delete('/:id', adminCouponController.deleteCoupon); 

module.exports = router;