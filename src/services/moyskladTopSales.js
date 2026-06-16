const axios = require("axios");
const product = require("../models/Product");

const MOYSKLAD_API_URL = "https://api.moysklad.ru/api/remap/1.2";

const getAuthHeaders = () => ({
  Authorization: `Bearer ${process.env.MOYSKLAD_TOKEN}`,
  Accept: "application/json",
});

const formateDate = (date) => {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
};

const getBarcodeFromAssortment = (assortment = {}) => {
  const barcodes = assortment.barcodes || [];

  for (const barcode of barcodes) {
    if (barcode.ean13) return barcode.ean13;
    if (barcode.ean8) return barcode.ean8;
    if (barcode.code128) return barcode.code128;
    if (barcode.gtin) return barcode.gtin;
  }

  return assortment.barcode || assortment.code || "";
};

const fetchDemandPositions = async (demandId) => {
  const response = await axios.get(
    `${MOYSKLAD_API_URL}/entity/demand/${demandId}/positions`,
    {
      headers: getAuthHeaders(),
      params: {
        limit: 1000,
      },
    },
  );

  return response.data.rows || [];
};

const fetchDemands = async ({ from, to }) => {
  const filter = [`moment>=${from} 00:00:00`, `moment<=${to} 23:59:59`].join(
    ";",
  );

  const response = await axios.get(`${MOYSKLAD_API_URL}/entity/demand`, {
    headers: getAuthHeaders(),
    params: {
      limit: 100,
      filter,
    },
  });

  return response.data.rows || [];
};

const getTopSalesFromMoysklad = async ({ days = 7, limit = 8 }) => {
  const toDate = new Date();
  const fromDate = new Date();

  fromDate.setDate(toDate.getDate() - days + 1);

  const from = formatDate(fromDate);
  const to = formatDate(toDate);

  const demands = await fetchDemands({ from, to });
  const salesMap = new Map();

  for (const demand of demands) {
    const positions = await fetchDemandPositions(demand.id);

    for (const position of positions) {
      const assortment = position.assortment || {};
      const barcode = getBarcodeFromAssortment(assortment);

      if (!barcode) continue;

      const current = salesMap.get(barcode) || {
        barcode,
        soldQuantity: 0,
      };

      current.soldQuantity += Number(position.quantity || 0);
      salesMap.set(barcode, current);
    }
  }

  const sales = [...salesMap.values()]
    .sort((a, b) => b.soldQuantity - a.soldQuantity)
    .slice(0, limit);

  const barcodes = sales.map((item) => item.barcode);

  const products = await Product.find({
    barcode: { $in: barcodes },
  })
    .populate("author", "name")
    .populate("category", "title name subgenres")
    .lean();

  const productByBarcode = new Map(
    products.map((product) => [String(product.barcode), product]),
  );

  return sales
    .map((sale) => {
      const product = productByBarcode.get(String(sale.barcode));
      if (!product) return null;

      return {
        ...product,
        soldQuantity: sale.soldQuantity,
      };
    })
    .filter(Boolean);
};

module.exports = {
  getTopSalesFromMoysklad,
};
