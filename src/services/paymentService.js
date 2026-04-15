const Order = require('../models/Order');
const crypto = require('crypto');

class PaymentService {
  /**
   * CLICK INTEGRATSIYASI
   */
  async handleClickCallback(data) {
    const {
      click_trans_id,
      service_id,
      click_paydoc_id,
      merchant_trans_id, 
      amount,
      action,
      error,
      sign_time,
      sign_string
    } = data;

    const mySignString = crypto
      .createHash('md5')
      .update(`${click_trans_id}${service_id}${process.env.CLICK_SECRET_KEY}${merchant_trans_id}${amount}${action}${sign_time}`)
      .digest('hex');

    if (mySignString !== sign_string) {
      return { error: -1, error_note: "Sign string mismatch" };
    }

    // 2. Buyurtmani topish
    const order = await Order.findById(merchant_trans_id);
    if (!order) return { error: -5, error_note: "Order not found" };

    // 3. To'lov summasini tekshirish
    if (parseFloat(amount) !== order.totalAmount) {
      return { error: -2, error_note: "Incorrect amount" };
    }

    // 4. To'lovni tasdiqlash (Prepare yoki Complete)
    if (action === '0') { 
      return { click_trans_id, merchant_trans_id, error: 0, error_note: "Success" };
    } else if (action === '1') {
      if (error < 0) return { error: -9, error_note: "Transaction cancelled" };
      
      order.paymentStatus = 'PAID';
      order.status = 'CONFIRMED';
      await order.save();
      
      return { click_trans_id, merchant_trans_id, error: 0, error_note: "Success" };
    }
  }

  /**
   * UZUM BANK INTEGRATSIYASI
   */

  async handleUzumCallback(data) {
    const { serviceId, orderId, amount, status } = data;

    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    if (status === 1) {
      order.paymentStatus = 'PAID';
      order.status = 'CONFIRMED';
      await order.save();
    }

    return { success: true };
  }
}

module.exports = new PaymentService();