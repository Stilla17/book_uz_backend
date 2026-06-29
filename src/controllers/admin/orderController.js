const Order = require('../../models/Order');
const Product = require('../../models/Product');
const User = require('../../models/User');
const apiResponse = require('../../utils/apiResponse');
const socketEvents = require('../../sockets/events');
const { getPaginationParams, buildPagination } = require('../../utils/pagination');
const { buildSearchRegex, normalizeSearchText } = require('../../utils/searchRegex');
const { isValidEmail, isValidPhone } = require('../../utils/validator');
const { formatUzPhone, normalizePhone } = require('../../utils/phone');
const generateTempPassword = require('../../utils/passwordGenerator');
const orderService = require('../../services/orderService');
const bcrypt = require('bcrypt');

const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];
const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED'];
const PAYMENT_TYPES = ['CASH', 'CLICK', 'UZUM', 'PAYME', 'XAZNA'];
const DELIVERY_TYPES = ['PICKUP', 'DELIVERY', 'POST'];
const POST_DELIVERY_TYPES = ['POST_OFFICE', 'POST_TO_HOME'];

const buildPhoneVariants = (phone) => {
  const formattedPhone = formatUzPhone(phone);
  const phoneDigits = normalizePhone(formattedPhone);
  const localPhone = phoneDigits.startsWith('998')
    ? phoneDigits.slice(3)
    : phoneDigits;

  return [
    formattedPhone,
    phoneDigits,
    localPhone,
    `+${phoneDigits}`,
    `+998${localPhone}`,
  ].filter(Boolean);
};

const findOrCreateManualUser = async (customer = {}, userId) => {
  if (userId) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error("Foydalanuvchi topilmadi");
      error.statusCode = 404;
      throw error;
    }

    return { user, temporaryPassword: null, created: false };
  }

  const normalizedName = customer.name?.toString().trim();
  const normalizedEmail = customer.email
    ? customer.email.toString().trim().toLowerCase()
    : '';
  const formattedPhone = customer.phone ? formatUzPhone(customer.phone) : '';
  let parsedBirthDate = null;

  if (customer.birthDate) {
    parsedBirthDate = new Date(customer.birthDate);
    if (Number.isNaN(parsedBirthDate.getTime())) {
      const error = new Error("Tug'ilgan sana noto'g'ri");
      error.statusCode = 400;
      throw error;
    }
  }

  if (!normalizedName || normalizedName.length < 2) {
    const error = new Error("Mijoz ismi kamida 2 ta belgidan iborat bo'lishi kerak");
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedEmail && !formattedPhone) {
    const error = new Error("Mijoz uchun email yoki telefon raqamdan kamida bittasi kerak");
    error.statusCode = 400;
    throw error;
  }

  const duplicateChecks = [];

  if (normalizedEmail) {
    if (!isValidEmail(normalizedEmail)) {
      const error = new Error("Email formati noto'g'ri");
      error.statusCode = 400;
      throw error;
    }
    duplicateChecks.push({ email: normalizedEmail });
  }

  if (formattedPhone) {
    if (!isValidPhone(formattedPhone)) {
      const error = new Error("Telefon raqam formati noto'g'ri. Masalan +998901234567");
      error.statusCode = 400;
      throw error;
    }
    duplicateChecks.push({ phone: { $in: buildPhoneVariants(formattedPhone) } });
  }

  const existingUser = duplicateChecks.length
    ? await User.findOne({ $or: duplicateChecks })
    : null;

  if (existingUser) {
    let changed = false;

    if (normalizedName && existingUser.name !== normalizedName) {
      existingUser.name = normalizedName;
      changed = true;
    }
    if (formattedPhone && existingUser.phone !== formattedPhone) {
      existingUser.phone = formattedPhone;
      changed = true;
    }
    if (normalizedEmail && existingUser.email !== normalizedEmail) {
      existingUser.email = normalizedEmail;
      changed = true;
    }
    if (
      parsedBirthDate &&
      (!existingUser.birthDate ||
        existingUser.birthDate.getTime() !== parsedBirthDate.getTime())
    ) {
      existingUser.birthDate = parsedBirthDate;
      changed = true;
    }

    if (changed) await existingUser.save();
    return { user: existingUser, temporaryPassword: null, created: false };
  }

  const temporaryPassword = customer.password || generateTempPassword();
  if (temporaryPassword.length < 6) {
    const error = new Error("Parol kamida 6 ta belgidan iborat bo'lishi kerak");
    error.statusCode = 400;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(temporaryPassword, salt);

  const user = await User.create({
    name: normalizedName,
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    ...(formattedPhone ? { phone: formattedPhone } : {}),
    ...(parsedBirthDate ? { birthDate: parsedBirthDate } : {}),
    password: hashedPassword,
    role: 'USER',
    isVerified: true,
  });

  return {
    user,
    temporaryPassword: customer.password ? null : temporaryPassword,
    created: true,
  };
};

const buildOrderSearchFilter = async (value) => {
  const search = normalizeSearchText(value);
  if (!search) return {};

  const searchRegex = buildSearchRegex(search);
  const [products, users] = await Promise.all([
    Product.find({
      $or: [
        { 'title.uz': searchRegex },
        { 'title.ru': searchRegex },
        { 'title.en': searchRegex },
        { barcode: searchRegex },
      ],
    }).select('_id'),
    User.find({
      $or: [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ],
    }).select('_id'),
  ]);

  const filters = [
    { guestName: searchRegex },
    { description: searchRegex },
    { couponCode: searchRegex },
    { 'shippingAddress.city': searchRegex },
    { 'shippingAddress.region': searchRegex },
    { 'shippingAddress.street': searchRegex },
    { 'shippingAddress.phone': searchRegex },
  ];

  const orderNumber = Number(search);
  if (Number.isInteger(orderNumber) && orderNumber > 0) {
    filters.push({ orderNumber });
  }

  const productIds = products.map((product) => product._id);
  if (productIds.length) {
    filters.push({ 'items.product': { $in: productIds } });
  }

  const userIds = users.map((user) => user._id);
  if (userIds.length) {
    filters.push({ user: { $in: userIds } });
  }

  return { $or: filters };
};

/**
 * 1. Barcha buyurtmalarni olish (Filtr va Pagination bilan)
 */

exports.getAllOrders = async (req, res, next) => {
  try {
    const { status } = req.query;
    const paginationParams = getPaginationParams(req.query);
    let filter = await buildOrderSearchFilter(req.query.search || req.query.q);
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
 * 2. Bitta buyurtma tafsilotlarini olish
 */
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone avatar')
      .populate(
        'items.product',
        'title slug price discountPrice images stock barcode author publisher'
      );

    if (!order) {
      return apiResponse(res, 404, false, "Buyurtma topilmadi");
    }

    apiResponse(res, 200, true, "Buyurtma tafsilotlari", order);
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Admin tomonidan ruchnoy mijoz va xaridlarini saqlash
 */
exports.createManualOrder = async (req, res, next) => {
  try {
    const {
      userId,
      customer,
      items,
      shippingAddress = {},
      deliveryType = 'PICKUP',
      postDeliveryType,
      paymentType = 'CASH',
      paymentStatus = 'PAID',
      status = 'DELIVERED',
      description,
    } = req.body;

    if (!Array.isArray(items) || !items.length) {
      return apiResponse(res, 400, false, "Kamida bitta kitob yuborilishi kerak");
    }

    if (!PAYMENT_TYPES.includes(paymentType)) {
      return apiResponse(res, 400, false, "paymentType noto'g'ri");
    }

    if (!DELIVERY_TYPES.includes(deliveryType)) {
      return apiResponse(res, 400, false, "deliveryType noto'g'ri");
    }

    if (deliveryType === 'POST' && postDeliveryType && !POST_DELIVERY_TYPES.includes(postDeliveryType)) {
      return apiResponse(res, 400, false, "postDeliveryType noto'g'ri");
    }

    if (!PAYMENT_STATUSES.includes(paymentStatus)) {
      return apiResponse(res, 400, false, "paymentStatus noto'g'ri");
    }

    if (!ORDER_STATUSES.includes(status)) {
      return apiResponse(res, 400, false, "status noto'g'ri");
    }

    const { user, temporaryPassword, created } = await findOrCreateManualUser(
      customer,
      userId,
    );

    const orderShippingAddress = {
      ...shippingAddress,
      phone: shippingAddress.phone || user.phone || customer?.phone,
    };

    if (!orderShippingAddress.phone) {
      return apiResponse(res, 400, false, "Telefon raqami yuborilishi shart");
    }

    const order = await orderService.createOrder(user._id, {
      items,
      useProvidedItems: true,
      allowOutOfStock: true,
      shippingAddress: orderShippingAddress,
      deliveryType,
      postDeliveryType,
      paymentType,
      guestName: user.name,
      description: description || "Admin panel orqali ruchnoy qo'shildi",
    });

    order.status = status;
    order.paymentStatus = paymentStatus;
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'name email phone')
      .populate('items.product', 'title price discountPrice images barcode');

    socketEvents.emitNewOrder(populatedOrder);

    apiResponse(res, 201, true, "Ruchnoy buyurtma saqlandi", {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        created,
      },
      temporaryPassword,
      order: populatedOrder,
    });
  } catch (error) { next(error); }
};

/**
 * 4. Buyurtma statusini yangilash (Eng muhim joyi)
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
 * 5. Buyurtmani o'chirish (Faqat bekor qilinganlarni)
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
