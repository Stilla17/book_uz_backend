const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    mongoose.set("strictQuery", true);

    // .env o'qilayotganini tekshirish uchun log
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI .env faylidan topilmadi!");
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB ulandi: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB ulanish xatosi:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;