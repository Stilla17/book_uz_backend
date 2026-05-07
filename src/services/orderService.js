const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const Coupon = require("../models/Coupon");

class OrderService {
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

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let cart = null;
      let sourceItems = [];

      if (normalizedUserId) {
        cart = await Cart.findOne({ user: normalizedUserId }).populate(
          "items.product",
        );
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
            quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
          }))
          .filter((item) => item.product);
      }

      if (!sourceItems.length) {
        throw new Error("Savat bo'sh, buyurtma berib bo'lmaydi");
      }

      let subTotal = 0;
      const orderItems = [];

      // 3. Mahsulotlarni tekshirish va omborni yangilash
      for (const item of sourceItems) {
        const product = item.product;

        if (!product || product.stock < item.quantity) {
          throw new Error(
            `Omborda yetarli emas: ${product ? product.title.uz : "Noma'lum mahsulot"}`,
          );
        }

        const price =
          product.discountPrice > 0 ? product.discountPrice : product.price;
        subTotal += price * item.quantity;

        orderItems.push({
          product: product._id,
          quantity: item.quantity,
          priceAtTime: price, // Sotib olingan vaqtdagi narxni muhrlaymiz
        });

        // Ombordan kamaytirish. Product documentni save qilmaymiz, chunki eski importlardan
        // author/category populated object bo'lib qolgan productlar validatsiyada yiqilishi mumkin.
        const stockUpdate = await Product.updateOne(
          { _id: product._id, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session },
        );

        if (stockUpdate.modifiedCount !== 1) {
          throw new Error(
            `Omborda yetarli emas: ${product.title?.uz || "Noma'lum mahsulot"}`,
          );
        }
      }

      // 4. Kuponni tekshirish (Agar bo'lsa)
      let discount = 0;
      if (couponCode) {
        const coupon = await Coupon.findOne({
          code: couponCode.toUpperCase(),
          isActive: true,
        });
        if (
          coupon &&
          Date.now() < coupon.expiryDate &&
          subTotal >= coupon.minOrderAmount
        ) {
          discount = (subTotal * coupon.discountPercentage) / 100;
          coupon.usedCount += 1;
          await coupon.save({ session });
        }
      }

      const deliveryFee = deliveryType === "EXPRESS" ? 20000 : 20000;
      const totalAmount = subTotal - discount + deliveryFee;

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
            totalAmount,
            discountAmount: discount,
            deliveryFee,
            shippingAddress,
            deliveryType,
            paymentType,
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
}

module.exports = new OrderService();
