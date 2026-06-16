const apiResponse = require("../../utils/apiResponse");
const {
  getCachedTopSales,
  syncMoyskladTopSales,
} = require("../../services/moyskladTopSales.service");

const normalizePeriod = (period) => (period === "month" ? "month" : "week");

const getTopSales = async (req, res, next) => {
  try {
    const period = normalizePeriod(req.query.period);
    const limit = Math.min(Number(req.query.limit || 10), 10);
    const cache = await getCachedTopSales(period);

    if (!cache) {
      return apiResponse(res, 200, true, "Top sotuvlar hali sinxron qilinmagan", {
        period,
        products: [],
        syncedAt: null,
      });
    }

    apiResponse(res, 200, true, "Top sotilgan kitoblar", {
      period,
      from: cache.from,
      to: cache.to,
      syncedAt: cache.syncedAt,
      products: cache.products.slice(0, limit),
    });
  } catch (error) {
    next(error);
  }
};

const syncTopSales = async (req, res, next) => {
  try {
    await syncMoyskladTopSales();
    apiResponse(res, 200, true, "Top sotuvlar sinxronizatsiyasi ishga tushdi");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTopSales,
  syncTopSales,
};