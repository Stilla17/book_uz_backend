const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/user/orderController');
const { optionalProtect, protect } = require('../../middlewares/auth'); 


router.post('/', optionalProtect, orderController.placeOrder); // Buyurtma berish
router.post('/guest/track', orderController.trackGuestOrder); // Guest buyurtmani kuzatish

router.use(protect);
router.get('/my-orders', orderController.getMyOrders);  // Mening buyurtmalarim
router.get('/:id', orderController.getOrderDetails);    // Buyurtma detali
router.put('/:id/cancel', orderController.cancelOrder); // Bekor qilish
router.post('/:id/reorder', orderController.reOrder);  // Qayta buyurtma berish

module.exports = router;
