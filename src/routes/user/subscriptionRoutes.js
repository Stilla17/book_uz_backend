// backend/src/routes/user/subscriptionRoutes.js
const express = require('express');
const router = express.Router();
const subscriptionController = require('../../controllers/user/subscriptionController');
const { protect } = require('../../middlewares/auth');

// Public routes
router.get('/plans', subscriptionController.getPlans);

// Protected routes
router.use(protect);
router.get('/my', subscriptionController.getUserSubscription);
router.post('/subscribe', subscriptionController.subscribe);
router.delete('/:id/cancel', subscriptionController.cancelSubscription);
router.get('/history', subscriptionController.getSubscriptionHistory);
router.get('/check-access', subscriptionController.checkAccess);

module.exports = router;