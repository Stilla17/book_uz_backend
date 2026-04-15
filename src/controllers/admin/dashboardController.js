const Order = require('../../models/Order');
const User = require('../../models/User');
const Product = require('../../models/Product');
const apiResponse = require('../../utils/apiResponse');

/**
 * 1. Asosiy Statistika (Summary Stats)
 * Bugungi savdo, umumiy foyda va asosiy counterlar
 */

const getStats = async (req, res, next) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [basicStats, todayRevenue, totalRevenue] = await Promise.all([
      Promise.all([
        Order.countDocuments(),
        User.countDocuments({ role: 'USER' }),
        Product.countDocuments(),
        Order.countDocuments({ createdAt: { $gte: startOfToday } }),
        Product.countDocuments({ stock: { $lt: 5 } }) 
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfToday }, paymentStatus: 'PAID', status: { $ne: 'CANCELLED' } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]),
      Order.aggregate([
        { $match: { paymentStatus: 'PAID', status: { $ne: 'CANCELLED' } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ])
    ]);

    apiResponse(res, 200, true, "Dashboard statistikasi", {
      counters: {
        totalOrders: basicStats[0],
        totalUsers: basicStats[1],
        totalProducts: basicStats[2],
        todayOrders: basicStats[3],
        lowStockProducts: basicStats[4]
      },
      revenue: {
        today: todayRevenue[0]?.total || 0,
        total: totalRevenue[0]?.total || 0
      }
    });
  } catch (error) { next(error); }
};

/**
 * 2. Haftalik Savdo Grafigi (Sales Chart Data)
 * Oxirgi 7 kunlik savdoni kunma-kun chiqarib beradi
 */

const getSalesChartData = async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const chartData = await Order.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, paymentStatus: 'PAID' } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          dailyRevenue: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    apiResponse(res, 200, true, "Haftalik savdo ma'lumotlari", chartData);
  } catch (error) { next(error); }
};

/**
 * 3. Eng ko'p sotilgan kitoblar (Top Selling Products)
 */

const getTopProducts = async (req, res, next) => {
  try {
    const topProducts = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalSold: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.quantity", "$items.priceAtTime"] } }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products", 
          localField: "_id",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $project: {
          totalSold: 1,
          revenue: 1,
          title: "$productDetails.title",
          images: "$productDetails.images"
        }
      }
    ]);

    apiResponse(res, 200, true, "Top 5 kitoblar", topProducts);
  } catch (error) { next(error); }
};

/**
 * 4. To'lov turlari bo'yicha tahlil (Payment Methods Breakdown)
 */

const getPaymentStats = async (req, res, next) => {
  try {
    const paymentBreakdown = await Order.aggregate([
      {
        $group: {
          _id: "$paymentType",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" }
        }
      }
    ]);

    apiResponse(res, 200, true, "To'lov turlari statistikasi", paymentBreakdown);
  } catch (error) { next(error); }
};



const getInventoryReport = async (req, res, next) => {
  try {
    const lowStock = await Product.find({ stock: { $lt: 10 } })
      .select('title stock price')
      .limit(10);
      
    const outOfStock = await Product.countDocuments({ stock: 0 });

    apiResponse(res, 200, true, "Inventar hisoboti", { lowStock, outOfStock });
  } catch (error) { next(error); }
};




const getUserAnalytics = async (req, res, next) => {
  try {
    const lastMonth = new Date();
    lastMonth.setDate(lastMonth.getDate() - 30);

    const [newUsers, activeCustomers] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: lastMonth }, role: 'USER' }),
      Order.distinct('user', { createdAt: { $gte: lastMonth } })
    ]);

    apiResponse(res, 200, true, "Foydalanuvchilar tahlili", {
      newUsersLastMonth: newUsers,
      activeCustomersLastMonth: activeCustomers.length
    });
  } catch (error) { next(error); }
};

module.exports = { 
  getStats, 
  getSalesChartData, 
  getTopProducts, 
  getPaymentStats,
  getInventoryReport,
  getUserAnalytics
};