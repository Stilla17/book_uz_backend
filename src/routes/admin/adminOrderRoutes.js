const express = require('express');
const router = express.Router();
const adminOrderController = require('../../controllers/admin/adminOrderController');
const { protect, restrictTo } = require('../../middlewares/auth');

router.use(protect, restrictTo('admin'));

router.get('/', adminOrderController.getAllOrders);
router.patch('/:id/status', adminOrderController.updateOrderStatus); 
router.delete('/:id', adminOrderController.deleteOrder); 

module.exports = router;