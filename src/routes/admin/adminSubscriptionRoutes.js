// backend/src/routes/admin/adminSubscriptionRoutes.js
const express = require('express');
const router = express.Router();
const subscriptionController = require('../../controllers/admin/adminSubscriptionController');
const { protect, restrictTo } = require('../../middlewares/auth');


router.use(protect);
router.use(restrictTo('admin'));

// Subscription management
router.get('/', subscriptionController.getAllSubscriptions);
router.get('/:id', subscriptionController.getSubscription);
router.post('/', subscriptionController.createSubscription);
router.put('/:id', subscriptionController.updateSubscription);
router.delete('/:id', subscriptionController.deleteSubscription);
router.patch('/:id/toggle', subscriptionController.toggleSubscriptionStatus);
router.post('/update-order', subscriptionController.updateOrder);

module.exports = router;