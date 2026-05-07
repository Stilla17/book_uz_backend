const { prepare, complete } = require("../payment/click/clickHandler");
const { buildClickUrl } = require("../payment/click/clickService");
const Order = require("../models/Order");

async function findUserClickOrder(orderId, userId) {
  if (!orderId) {
    const error = new Error("orderId yuborilishi shart");
    error.statusCode = 400;
    throw error;
  }

  const order = await Order.findById(orderId);
  if (!order) {
    const error = new Error("Buyurtma topilmadi");
    error.statusCode = 404;
    throw error;
  }

  if (String(order.user) !== String(userId)) {
    const error = new Error("Bu buyurtma uchun ruxsat yo'q");
    error.statusCode = 403;
    throw error;
  }

  if (order.paymentType !== "CLICK") {
    const error = new Error("Bu buyurtma Click orqali to'lash uchun yaratilmagan");
    error.statusCode = 400;
    throw error;
  }

  if (order.paymentStatus === "PAID") {
    const error = new Error("Buyurtma allaqachon to'langan");
    error.statusCode = 400;
    throw error;
  }

  return order;
}

const clickPrepare = async (req, res) => {
  try {
    console.log("Click PREPARE:", JSON.stringify(req.body));
    const result = await prepare(req.body);
    console.log("Click PREPARE response:", result);
    res.json(result);
  } catch (err) {
    console.error("Click PREPARE xato:", err);
    res.json({
      click_trans_id: req.body?.click_trans_id,
      merchant_trans_id: req.body?.merchant_trans_id,
      error: -8,
      error_note: "Internal server error",
    });
  }
};

const clickComplete = async (req, res) => {
  try {
    console.log("Click COMPLETE:", JSON.stringify(req.body));
    const result = await complete(req.body);
    console.log("Click COMPLETE response:", result);
    res.json(result);
  } catch (err) {
    console.error("Click COMPLETE xato:", err);
    res.json({
      click_trans_id: req.body?.click_trans_id,
      merchant_trans_id: req.body?.merchant_trans_id,
      error: -8,
      error_note: "Internal server error",
    });
  }
};

const createOrder = async (req, res) => {
  try {
    const order = await findUserClickOrder(req.body.orderId, req.user._id);
    const clickUrl = buildClickUrl(order._id.toString(), order.totalAmount);

    res.json({
      success: true,
      message: "Click to'lov sahifasiga o'tish uchun link yaratildi",
      orderId: order._id,
      amount: order.totalAmount,
      clickUrl,
      payment: {
        type: "CLICK_REDIRECT",
        redirectUrl: clickUrl,
      },
    });
  } catch (err) {
    console.error("Click redirect link yaratish xato:", err);
    res
      .status(err.statusCode || 500)
      .json({ success: false, message: err.message || "Server xatosi" });
  }
};

const getOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).lean();
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Buyurtma topilmadi" });
    }

    if (String(order.user) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Bu buyurtma uchun ruxsat yo'q",
      });
    }

    res.json({
      success: true,
      order: {
        _id: order._id,
        totalAmount: order.totalAmount,
        paymentType: order.paymentType,
        paymentStatus: order.paymentStatus,
        status: order.status,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server xatosi" });
  }
};

module.exports = {
  clickPrepare,
  clickComplete,
  createOrder,
  getOrderStatus,
};
