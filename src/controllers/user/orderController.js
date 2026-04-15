const Order = require('../../models/Order');
const orderService = require('../../services/orderService');
const socketEvents = require('../../sockets/events');
const apiResponse = require('../../utils/apiResponse');


/**
 * 1. Yangi buyurtma yaratish (Place Order)
 */

const placeOrder = async (req, res, next) => {
  try {
    const order = await orderService.createOrder(req.user._id, req.body);
    
    socketEvents.emitNewOrder(order);

    apiResponse(res, 201, true, "Buyurtma muvaffaqiyatli qabul qilindi", order);
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Foydalanuvchining barcha buyurtmalarini olish (Filter bilan)
 */

const getMyOrders = async (req, res, next) => {
  try {
    const { status } = req.query;
    let filter = { user: req.user._id };
    
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate('items.product', 'title images price')
      .sort('-createdAt');

    apiResponse(res, 200, true, "Buyurtmalar ro'yxati", orders);
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Bitta buyurtmaning batafsil ma'lumoti (Order Detail)
 * Bu foydalanuvchiga "Order Tracking" sahifasi uchun kerak
 */

const getOrderDetails = async (req, res, next) => {
  try {
    const order = await Order.findOne({ 
      _id: req.params.id, 
      user: req.user._id 
    }).populate('items.product');

    if (!order) {
      return apiResponse(res, 404, false, "Buyurtma topilmadi");
    }

    apiResponse(res, 200, true, "Buyurtma tafsilotlari", order);
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Buyurtmani bekor qilish (Cancel Order)
 * Faqat 'PENDING' statusidagilarni bekor qilish mumkin
 */

const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ 
      _id: req.params.id, 
      user: req.user._id 
    });

    if (!order) {
      return apiResponse(res, 404, false, "Buyurtma topilmadi");
    }

    if (order.status !== 'PENDING') {
      return apiResponse(res, 400, false, "Bu buyurtmani bekor qilib bo'lmaydi, chunki u jarayonda");
    }

    order.status = 'CANCELLED';
    await order.save();

    socketEvents.emitOrderStatusUpdate(req.user._id, order._id, 'CANCELLED');

    apiResponse(res, 200, true, "Buyurtma bekor qilindi", order);
  } catch (error) {
    next(error);
  }
};


const reOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return apiResponse(res, 404, false, "Buyurtma topilmadi");

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    for (const item of order.items) {
      const itemIndex = cart.items.findIndex(p => p.product.toString() === item.product.toString());
      if (itemIndex > -1) {
        cart.items[itemIndex].quantity += item.quantity;
      } else {
        const product = await Product.findById(item.product);
        cart.items.push({ product: item.product, quantity: item.quantity, price: product.price });
      }
    }

    await cart.save();
    apiResponse(res, 200, true, "Mahsulotlar savatga qayta qo'shildi", cart);
  } catch (error) { next(error); }
};

module.exports = { 
  placeOrder, 
  getMyOrders, 
  getOrderDetails, 
  cancelOrder,
  reOrder
};