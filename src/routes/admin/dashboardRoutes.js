const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/admin/dashboardController');
const { protect, restrictTo } = require('../../middlewares/auth');

/**
 * XAVFSIZLIK: Dashboard ma'lumotlari biznes siridir. 
 * Shuning uchun faqat login qilgan Adminlar kira oladi.
 */
router.use(protect, restrictTo('admin'));

/**
 * DASHBOARD ANALYTIKS
 */

// 1. Umumiy va bugungi statistikalar (Counters & Revenue)
// GET /api/v1/admin/dashboard/stats
router.get('/stats', dashboardController.getStats);

// 2. Haftalik savdo grafigi uchun ma'lumotlar
// GET /api/v1/admin/dashboard/sales-chart
router.get('/sales-chart', dashboardController.getSalesChartData);

// 3. Eng ko'p sotilgan top 5 kitob
// GET /api/v1/admin/dashboard/top-products
router.get('/top-products', dashboardController.getTopProducts);

// 4. To'lov usullari bo'yicha tahlil (Click, Uzum, Cash)
// GET /api/v1/admin/dashboard/payment-stats
router.get('/payment-stats', dashboardController.getPaymentStats);

router.get('/inventory', dashboardController.getInventoryReport); 

router.get('/user-analytics', dashboardController.getUserAnalytics);

module.exports = router;