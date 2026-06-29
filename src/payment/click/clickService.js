const crypto = require("crypto");
const clickConfig = require("../../config/click");

function getRequiredRedirectConfig() {
  const missing = [];
  if (!clickConfig.merchantId) missing.push("CLICK_MERCHANT_ID");
  if (!clickConfig.serviceId) missing.push("CLICK_SERVICE_ID");

  if (missing.length) {
    throw new Error(`Click sozlamalari yetishmayapti: ${missing.join(", ")}`);
  }
}

function verifyClickSign(body, action) {
  const {
    click_trans_id,
    service_id,
    click_paydoc_id,
    merchant_prepare_id,
    amount,
    action: act,
    sign_time,
    sign_string,
  } = body;
  const merchant_trans_id = String(
    body.merchant_trans_id ||
      body.transaction_param ||
      body.merchant_transaction_id ||
      "",
  ).trim();

  const secretKey = process.env.CLICK_SECRET_KEY;
  if (!secretKey || !sign_string) return false;

  let raw;
  if (action === "prepare") {
    raw = `${click_trans_id}${service_id}${secretKey}${merchant_trans_id}${amount}${act}${sign_time}`;
  } else {
    raw = `${click_trans_id}${service_id}${secretKey}${merchant_trans_id}${merchant_prepare_id}${amount}${act}${sign_time}`;
  }

  const mySign = crypto.createHash("md5").update(raw).digest("hex");
  const expected = Buffer.from(mySign);
  const received = Buffer.from(String(sign_string));

  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)
  );
}

function buildClickUrl(orderId, amount) {
  getRequiredRedirectConfig();

  const params = new URLSearchParams({
    service_id: clickConfig.serviceId,
    merchant_id: clickConfig.merchantId,
    amount: Number(amount).toFixed(2),
    transaction_param: orderId,
    return_url: clickConfig.returnUrl,
  });

  return `${clickConfig.baseUrl}?${params.toString()}`;
}

module.exports = {
  verifyClickSign,
  buildClickUrl,
};
