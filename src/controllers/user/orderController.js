const Order = require('../../models/Order');
const Cart = require('../../models/Cart');
const Product = require('../../models/Product');
const orderService = require('../../services/orderService');
const socketEvents = require('../../sockets/events');
const apiResponse = require('../../utils/apiResponse');
const { getEffectiveProductPrice } = require('../../utils/productDiscounts');
const { buildClickUrl } = require('../../payment/click/clickService');
const { buildPaymeCheckoutUrl } = require('../../payment/payme/paymeService');
const { formatUzPhone, normalizePhone } = require('../../utils/phone');


/**
 * 1. Yangi buyurtma yaratish (Place Order)
 */

const placeOrder = async (req, res, next) => {
  try {
    const order = await orderService.createOrder(req.user?._id || null, req.body);
    const responseData = order.toObject ? order.toObject() : order;

    if (order.paymentType === 'CLICK') {
      const clickUrl = buildClickUrl(order._id.toString(), order.totalAmount);
      responseData.clickUrl = clickUrl;
      responseData.payment = {
        type: 'CLICK_REDIRECT',
        redirectUrl: clickUrl,
      };
    }

    if (order.paymentType === 'PAYME') {
      const paymeUrl = buildPaymeCheckoutUrl(order._id.toString());
      responseData.paymeUrl = paymeUrl;
      responseData.payment = {
        type: 'PAYME_REDIRECT',
        redirectUrl: paymeUrl,
      };
    }
    
    socketEvents.emitNewOrder(order);

    apiResponse(res, 201, true, "Buyurtma muvaffaqiyatli qabul qilindi", responseData);
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
      .populate({
        path: 'items.product',
        select: 'title images price author publisher',
        populate: [
          { path: 'author' },
          { path: 'publisher' },
        ],
      })
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
    }).populate({
      path: 'items.product',
      populate: [
        { path: 'author' },
        { path: 'publisher' },
      ],
    });

    if (!order) {
      return apiResponse(res, 404, false, "Buyurtma topilmadi");
    }

    apiResponse(res, 200, true, "Buyurtma tafsilotlari", order);
  } catch (error) {
    next(error);
  }
};

const trackGuestOrder = async (req, res, next) => {
  try {
    const orderNumber = Number(req.body.orderNumber);
    const phone = String(req.body.phone || '').trim();

    if (!Number.isInteger(orderNumber) || !phone) {
      return apiResponse(
        res,
        400,
        false,
        "Order raqami va telefon raqami yuborilishi shart",
      );
    }

    const formattedPhone = formatUzPhone(phone);
    const phoneDigits = normalizePhone(formattedPhone);
    const localPhone = phoneDigits.startsWith('998')
      ? phoneDigits.slice(3)
      : phoneDigits;
    const phoneVariants = [
      phone,
      formattedPhone,
      phoneDigits,
      localPhone,
      `+${phoneDigits}`,
      localPhone ? `+998${localPhone}` : '',
    ].filter(Boolean);

    const order = await Order.findOne({
      orderNumber,
      "shippingAddress.phone": { $in: phoneVariants },
    }).populate({
      path: 'items.product',
      select: 'title images price author publisher',
      populate: [
        { path: 'author' },
        { path: 'publisher' },
      ],
    });

    if (!order) {
      return apiResponse(res, 404, false, "Buyurtma topilmadi");
    }

    apiResponse(res, 200, true, "Buyurtma holati", order);
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
    const order = await orderService.cancelOrder(req.user._id, req.params.id);

    socketEvents.emitOrderStatusUpdate(req.user._id, order._id, 'CANCELLED');

    apiResponse(res, 200, true, "Buyurtma bekor qilindi", order);
  } catch (error) {
    next(error);
  }
};


const reOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!order) return apiResponse(res, 404, false, "Buyurtma topilmadi");

    const productIds = order.items.map(item => item.product);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(
      products.map(product => [product._id.toString(), product]),
    );

    const unavailableItem = order.items.find((item) => {
      const product = productMap.get(item.product.toString());
      return !product || product.stock < item.quantity;
    });

    if (unavailableItem) {
      return apiResponse(
        res,
        400,
        false,
        "Buyurtmadagi ayrim mahsulotlar mavjud emas yoki omborda yetarli emas",
      );
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    for (const item of order.items) {
      const product = productMap.get(item.product.toString());
      const itemIndex = cart.items.findIndex(p => p.product.toString() === item.product.toString());
      const price = await getEffectiveProductPrice(product);
      if (itemIndex > -1) {
        cart.items[itemIndex].quantity += item.quantity;
        cart.items[itemIndex].price = price;
      } else {
        cart.items.push({ product: item.product, quantity: item.quantity, price });
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
  trackGuestOrder,
  cancelOrder,
  reOrder
};
