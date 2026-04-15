const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon');

class OrderService {
  async createOrder(userId, orderData) {
    const { 
      shippingAddress, 
      deliveryType, 
      paymentType, 
      couponCode 
    } = orderData;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const cart = await Cart.findOne({ user: userId }).populate('items.product');
      if (!cart || cart.items.length === 0) {
        throw new Error("Savat bo'sh, buyurtma berib bo'lmaydi");
      }

      let subTotal = 0;
      const orderItems = [];

      // 3. Mahsulotlarni tekshirish va omborni yangilash
      for (const item of cart.items) {
        const product = item.product;

        if (!product || product.stock < item.quantity) {
          throw new Error(`Omborda yetarli emas: ${product ? product.title.uz : 'Noma\'lum mahsulot'}`);
        }

        const price = product.discountPrice > 0 ? product.discountPrice : product.price;
        subTotal += price * item.quantity;

        orderItems.push({
          product: product._id,
          quantity: item.quantity,
          priceAtTime: price // Sotib olingan vaqtdagi narxni muhrlaymiz
        });

        // Ombordan kamaytirish
        product.stock -= item.quantity;
        await product.save({ session });
      }

      // 4. Kuponni tekshirish (Agar bo'lsa)
      let discount = 0;
      if (couponCode) {
        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
        if (coupon && Date.now() < coupon.expiryDate && subTotal >= coupon.minOrderAmount) {
          discount = (subTotal * coupon.discountPercentage) / 100;
          coupon.usedCount += 1;
          await coupon.save({ session });
        }
      }

      const deliveryFee = deliveryType === 'EXPRESS' ? 25000 : 15000;
      const totalAmount = subTotal - discount + deliveryFee;

      // 5. Buyurtma yaratish
      const order = await Order.create([{
        user: userId,
        items: orderItems,
        totalAmount,
        discountAmount: discount,
        deliveryFee,
        shippingAddress,
        deliveryType,
        paymentType,
        status: 'PENDING'
      }], { session });

      // 6. Savatni tozalash
      await Cart.findOneAndDelete({ user: userId }).session(session);

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