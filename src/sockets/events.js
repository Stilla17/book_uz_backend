const { getIO } = require('./socket');

const socketEvents = {
  emitNewOrder: async (order) => {
    const io = getIO();
    const payload = {
      type: 'NEW_ORDER',
      title: "Yangi buyurtma! ",
      message: `Yangi xarid: #${order._id.toString().slice(-6)}`,
      data: {
        orderId: order._id,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt
      }
    };

    // Admin room-ga yuborish
    io.to('admin-room').emit('notification:admin', payload);
  },

  /**
   * 2. Order statusi o'zgarganda (User uchun)
   */

  emitOrderStatusUpdate: (userId, orderId, status) => {
    const io = getIO();
    
    const statusMessages = {
      'PROCESSING': "Buyurtmangiz tayyorlanmoqda 🛠",
      'SHIPPED': "Buyurtmangiz yo'lga chiqdi 🚚",
      'DELIVERED': "Mahsulot yetkazib berildi ✅",
      'CANCELLED': "Buyurtmangiz bekor qilindi ❌"
    };

    const payload = {
      type: 'ORDER_STATUS',
      orderId,
      status,
      message: statusMessages[status] || `Buyurtma statusi: ${status}`
    };

    io.to(userId.toString()).emit('notification:user', payload);
  },

  /**
   * 3. Tizim bo'yicha global bildirishnoma (Masalan: Skidka yoki Yangilik)
   */

  emitBroadcast: (title, message) => {
    const io = getIO();
    io.emit('notification:all', {
      title,
      message,
      timestamp: new Date()
    });
  },

  /**
   * 4. Foydalanuvchi yozayotgani haqida (Typing...)
   */
  
  emitTyping: (roomId, userName) => {
    const io = getIO();
    io.to(roomId).emit('user:typing', { userName });
  }
};

module.exports = socketEvents;