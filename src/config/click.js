module.exports = {
  merchantId: process.env.CLICK_MERCHANT_ID,
  secretKey: process.env.CLICK_SECRET_KEY,
  serviceId: process.env.CLICK_SERVICE_ID,
  returnUrl:
    process.env.CLICK_RETURN_URL ||
    `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/click/return`,
  baseUrl: "https://my.click.uz/services/pay",
};
