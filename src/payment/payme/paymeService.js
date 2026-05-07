const paymeConfig = require("../../config/payme");

function getRequiredRedirectConfig() {
  const missing = [];
  if (!paymeConfig.KASSA_ID) missing.push("PAYME_KASSA_ID");

  if (missing.length) {
    throw new Error(`Payme sozlamalari yetishmayapti: ${missing.join(", ")}`);
  }
}

function getReturnUrl(orderId) {
  const returnUrl = new URL(paymeConfig.RETURN_URL);
  returnUrl.searchParams.set("orderId", String(orderId));
  return returnUrl.toString();
}

function normalizeOrderId(orderId) {
  if (typeof orderId === "string") {
    return orderId;
  }

  if (orderId && typeof orderId.toString === "function") {
    const value = orderId.toString();
    return value === "[object Object]" ? null : value;
  }

  return null;
}

function buildPaymeUrl(orderId, amount) {
  getRequiredRedirectConfig();
  const normalizedOrderId = normalizeOrderId(orderId);

  if (!normalizedOrderId) {
    throw new Error("Payme orderId berilmagan");
  }

  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw new Error("Payme amount noto'g'ri");
  }

  const amountInTiyin = Math.round(Number(amount) * 100);

  const params = [
    `m=${paymeConfig.KASSA_ID}`,
    `ac.order_id=${normalizedOrderId}`,
    `a=${amountInTiyin}`,
    `l=uz`,
    `c=${encodeURIComponent(getReturnUrl(normalizedOrderId))}`,
  ].join(";");

  const encodedParams = Buffer.from(params, "utf8").toString("base64");
  return `${paymeConfig.CHECKOUT_URL}/${encodeURIComponent(encodedParams)}`;
}

module.exports = {
  buildPaymeUrl,
};
