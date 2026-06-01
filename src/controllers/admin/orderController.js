const Order = require('../../models/Order');
const apiResponse = require('../../utils/apiResponse');
const socketEvents = require('../../sockets/events');
const { getPaginationParams, buildPagination } = require('../../utils/pagination');

/**
 * 1. Barcha buyurtmalarni olish (Filtr va Pagination bilan)
 */

exports.getAllOrders = async (req, res, next) => {
  try {
    const { status } = req.query;
    const paginationParams = getPaginationParams(req.query);
    let filter = {};
    if (status) filter.status = status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('user', 'name email phone')
        .populate('items.product', 'title price')
        .sort('-createdAt')
        .skip(paginationParams.skip)
        .limit(paginationParams.limit),
      Order.countDocuments(filter)
    ]);

    apiResponse(res, 200, true, "Barcha buyurtmalar", {
      orders,
      pagination: buildPagination({ ...paginationParams, total })
    });
  } catch (error) { next(error); }
};

/**
 * 2. Buyurtma statusini yangilash (Eng muhim joyi)
 */
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body; 
    const order = await Order.findById(req.params.id);

    if (!order) return apiResponse(res, 404, false, "Buyurtma topilmadi");

    order.status = status;
    
    if (status === 'DELIVERED' && order.paymentType === 'CASH') {
      order.paymentStatus = 'PAID';
    }

    await order.save();

    socketEvents.emitOrderStatusUpdate(order.user, order._id, status);

    apiResponse(res, 200, true, `Buyurtma statusi '${status}' ga o'zgartirildi`, order);
  } catch (error) { next(error); }
};

/**
 * 3. Buyurtmani o'chirish (Faqat bekor qilinganlarni)
 */

exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return apiResponse(res, 404, false, "Buyurtma topilmadi");

    if (order.status !== 'CANCELLED') {
      return apiResponse(res, 400, false, "Faqat bekor qilingan buyurtmalarni o'chirish mumkin");
    }

    await order.deleteOne();
    apiResponse(res, 200, true, "Buyurtma bazadan o'chirildi");
  } catch (error) { next(error); }
};
