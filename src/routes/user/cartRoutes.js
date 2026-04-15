const express = require('express');
const router = express.Router();
const cartController = require('../../controllers/user/cartController');
const { protect } = require('../../middlewares/auth');

router.use(protect);

// GET /api/v1/cart - Savatni ko'rish
router.get('/', cartController.getCart);

// POST /api/v1/cart/add - Qo'shish
router.post('/add', cartController.addToCart);

// PATCH /api/v1/cart/update - Miqdorni o'zgartirish (body: {productId, quantity})
router.patch('/update', cartController.updateCartItem);

// DELETE /api/v1/cart/remove/:productId - Bitta mahsulotni o'chirish
router.delete('/remove/:productId', cartController.removeFromCart);

// DELETE /api/v1/cart/clear - Savatni tozalash
router.delete('/clear', cartController.clearCart);

module.exports = router;