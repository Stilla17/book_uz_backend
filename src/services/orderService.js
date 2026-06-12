const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const Coupon = require("../models/Coupon");
const Counter = require("../models/Counter");
const { calculateCouponDiscount } = require("../utils/couponDiscount");

class OrderService {
  createError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
  }

  async createOrder(userId, orderData) {
    const normalizedUserId = mongoose.Types.ObjectId.isValid(userId)
      ? userId
      : null;
    const {
      shippingAddress,
      deliveryType,
      paymentType,
      guestName,
      description,
      couponCode,
    } = orderData;

    if (!shippingAddress?.phone) {
      throw this.createError("Telefon raqami yuborilishi shart");
    }

    if (
      !normalizedUserId &&
      !guestName &&
      !shippingAddress?.fullName &&
      !shippingAddress?.name
    ) {
      throw this.createError("Buyurtmachi ismi yuborilishi shart");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let cart = null;
      let sourceItems = [];

      if (normalizedUserId) {
        cart = await Cart.findOne({ user: normalizedUserId })
          .session(session)
          .populate("items.product");
        sourceItems = cart?.items || [];
      }

      if (!sourceItems.length && Array.isArray(orderData.items)) {
        const productIds = orderData.items
          .map((item) => item.product)
          .filter((productId) => mongoose.Types.ObjectId.isValid(productId));
        const products = await Product.find({
          _id: { $in: productIds },
        }).session(session);
        const productMap = new Map(
          products.map((product) => [product._id.toString(), product]),
        );

        sourceItems = orderData.items
          .map((item) => ({
            product: productMap.get(String(item.product)),
            quantity: Number(item.quantity),
          }))
          .filter(
            (item) =>
              item.product &&
              Number.isInteger(item.quantity) &&
              item.quantity > 0,
          );
      }

      if (!sourceItems.length) {
        throw this.createError("Savat bo'sh, buyurtma berib bo'lmaydi");
      }

      let subTotal = 0;
      const orderItems = [];

      // 3. Mahsulotlarni tekshirish va omborni yangilash
      for (const item of sourceItems) {
        const product = item.product;
        const quantity = Number(item.quantity);

        if (
          !product ||
          !Number.isInteger(quantity) ||
          quantity <= 0 ||
          product.stock < quantity
        ) {
          throw this.createError(
            `Omborda yetarli emas: ${product ? product.title.uz : "Noma'lum mahsulot"}`,
          );
        }

        const price =
          product.discountPrice > 0 ? product.discountPrice : product.price;
        subTotal += price * quantity;

        orderItems.push({
          product: product._id,
          quantity,
          priceAtTime: price, // Sotib olingan vaqtdagi narxni muhrlaymiz
        });

        // Ombordan kamaytirish. Product documentni save qilmaymiz, chunki eski importlardan
        // author/category populated object bo'lib qolgan productlar validatsiyada yiqilishi mumkin.
        const stockUpdate = await Product.updateOne(
          { _id: product._id, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          { session },
        );

        if (stockUpdate.modifiedCount !== 1) {
          throw this.createError(
            `Omborda yetarli emas: ${product.title?.uz || "Noma'lum mahsulot"}`,
          );
        }
      }

      // 4. Kuponni tekshirish (Agar bo'lsa)
      let discount = 0;
      let appliedCouponCode = "";
      if (couponCode) {
        const coupon = await Coupon.findOne({
          code: couponCode.toUpperCase(),
          isActive: true,
        }).session(session);
        const minOrderAmount = Number(coupon?.minOrderAmount || 0);
        const usageLimit = Number(coupon?.usageLimit || 0);
        const usedCount = Number(coupon?.usedCount || 0);
        const hasUsageLimit = usageLimit > 0;
        const now = Date.now();

        if (
          coupon &&
          now >= coupon.startDate &&
          now <= coupon.endDate &&
          subTotal >= minOrderAmount &&
          (!hasUsageLimit || usedCount < usageLimit)
        ) {
          const { eligibleSubtotal, discountAmount } = calculateCouponDiscount(
            coupon,
            sourceItems,
          );

          if (eligibleSubtotal > 0) {
            const usageFilter = { _id: coupon._id };
            if (hasUsageLimit) {
              usageFilter.usedCount = { $lt: usageLimit };
            }

            const usageUpdate = await Coupon.updateOne(
              usageFilter,
              { $inc: { usedCount: 1 } },
              { session },
            );

            if (usageUpdate.modifiedCount === 1) {
              discount = discountAmount;
              appliedCouponCode = coupon.code;
            }
          }
        }
      }

      const deliveryFee = deliveryType === "PICKUP" ? 0 : 20000;
      const totalAmount = subTotal - discount + deliveryFee;

      const counter = await Counter.findOneAndUpdate(
        { _id: "orderNumber" },
        { $inc: { sequence: 1 } },
        {
          new: true,
          upsert: true,
          session,
        },
      );
      const orderNumber = counter.sequence;

      // 5. Buyurtma yaratish
      const order = await Order.create(
        [
          {
            ...(normalizedUserId ? { user: normalizedUserId } : {}),
            guestName:
              guestName ||
              shippingAddress?.fullName ||
              shippingAddress?.name ||
              "",
            items: orderItems,
            description: description || "",
            couponCode: appliedCouponCode || undefined,
            totalAmount,
            discountAmount: discount,
            deliveryFee,
            shippingAddress,
            deliveryType,
            paymentType,
            orderNumber,
            status: "PENDING",
          },
        ],
        { session },
      );

      // 6. Savatni tozalash
      if (normalizedUserId) {
        await Cart.findOneAndDelete({ user: normalizedUserId }).session(
          session,
        );
      }

      // Hammasi muvaffaqiyatli bo'lsa, tasdiqlaymiz
      await session.commitTransaction();
      return order[0];
    } catch (error) {
      // Xato bo'lsa, barcha o'zgarishlarni bekor qilamiz
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async cancelOrder(userId, orderId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findOne({
        _id: orderId,
        user: userId,
      }).session(session);

      if (!order) {
        throw this.createError("Buyurtma topilmadi", 404);
      }

      if (order.status !== "PENDING") {
        throw this.createError(
          "Bu buyurtmani bekor qilib bo'lmaydi, chunki u jarayonda",
        );
      }

      if (order.paymentStatus === "PAID") {
        throw this.createError(
          "To'langan buyurtmani operator orqali bekor qiling",
          409,
        );
      }

      const cancelledOrder = await Order.findOneAndUpdate(
        {
          _id: order._id,
          user: userId,
          status: "PENDING",
        },
        { $set: { status: "CANCELLED" } },
        { new: true, session },
      );

      if (!cancelledOrder) {
        throw this.createError(
          "Buyurtma holati o'zgargan, qayta urinib ko'ring",
          409,
        );
      }

      if (order.items.length) {
        await Product.bulkWrite(
          order.items.map((item) => ({
            updateOne: {
              filter: { _id: item.product },
              update: { $inc: { stock: item.quantity } },
            },
          })),
          { session },
        );
      }

      await session.commitTransaction();
      return cancelledOrder;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new OrderService();
