const express = require('express');
const router = express.Router();

// Routerlarni import qilish
const authRoutes = require('./authRoutes');
const userOrderRoutes = require('./user/orderRoutes');
const userReviewRoutes = require('./user/reviewRoutes');
const userRoutes = require('./user/userRoutes');
const userProductRoutes = require('./user/productRoutes');
const userCartRoutes = require('./user/cartRoutes');
const userCouponRoutes = require('./user/couponRoutes');
const userSubscription = require('./user/subscriptionRoutes');
const searchRoutes = require('./user/searchRoutes');
const bannerRoutes = require('./user/bannerRoutes'); 
const categoryRoutes = require('./user/categoryRoutes');
const authorRoutes = require('./user/authorRoutes');
const publisherRoutes = require('./user/publisherRoutes');
// ... boshqa routerlar


// Admin tarafdagi barcha mashrutlar
const adminAuthorRoutes = require('./admin/authorRoutes');
const adminCategoryRoutes = require('./admin/categoryRoutes');
const adminDashboardRoutes = require('./admin/dashboardRoutes');
const adminProductRoutes = require('./admin/adminProductRoutes');
const adminReviewRoutes = require('./admin/reviewRoutes');
const adminUserRoutes = require('./admin/adminUserRoutes');
const adminCouponRoutes = require('./admin/couponRoutes');
const adminOrderRoutes = require('./admin/adminOrderRoutes');
const adminSubscription = require('./admin/adminSubscriptionRoutes');
const adminBannerRoutes = require('./admin/bannerRoutes');
const adminPublisherRoutes = require('./admin/publisherRoutes');


// Marshrutlarni ulash
router.use('/auth', authRoutes);               // /api/v1/auth/...
router.use('/orders', userOrderRoutes);        // /api/v1/orders/...
router.use('/reviews', userReviewRoutes);      // Ochiq yo'llar
router.use('/my-reviews', userReviewRoutes);    // /api/v1/my-reviews
router.use('/users', userRoutes);                // /api/v1/users
router.use('/products', userProductRoutes)      // /api/v1/products
router.use('/cart', userCartRoutes);              // /api/v1/cart
router.use('/coupons', userCouponRoutes);         // /api/v1/coupons
router.use('/search', searchRoutes);               // /api/v1/search
router.use('/subscription', userSubscription)
router.use('/banners', bannerRoutes); // Bannerlar uchun umumiy marshrutlar
router.use('/categories', categoryRoutes); // Kategoriyalar uchun umumiy marshrutlar
router.use('/authors', authorRoutes); // Mualliflar uchun umumiy marshrutlar
router.use('/publishers', publisherRoutes); // Nashriyotlar uchun umumiy marshrutlar

/**
 * ADMIN MARSHRUTLARI
 */
router.use('/admin/authors', adminAuthorRoutes); //
router.use('/admin/categories', adminCategoryRoutes); //
router.use('/admin/dashboard', adminDashboardRoutes);  // 
router.use('/admin/products', adminProductRoutes); //
router.use('/admin/reviews', adminReviewRoutes);  // 
router.use('/admin/users', adminUserRoutes);  // 
router.use('/admin/coupons', adminCouponRoutes); // 
router.use('/admin/orders', adminOrderRoutes); //
router.use('/admin/subscriptions', adminSubscription) //
router.use('/admin/banners', adminBannerRoutes); // Bannerlar uchun admin marshrutlari
router.use('/admin/publishers', adminPublisherRoutes); // Nashriyotlar uchun admin marshrutlari

module.exports = router;
