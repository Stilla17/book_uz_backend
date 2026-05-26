const paymeConfig = require("../../config/payme");

function getRequiredRedirectConfig() {
  const missing = [];

  if (!paymeConfig.KASSA_ID) missing.push("PAYME_KASSA_ID");
  if (!paymeConfig.CHECKOUT_URL) missing.push("PAYME_CHECKOUT_URL");
  if (!paymeConfig.RETURN_URL) missing.push("PAYME_RETURN_URL");

  if (missing.length) {
    throw new Error(`Payme sozlamalari yetishmayapti: ${missing.join(", ")}`);
  }
}

function getReturnUrl(orderId) {
  const baseReturnUrl =
    paymeConfig.RETURN_URL ||
    `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/payme/return`;

  const returnUrl = new URL(baseReturnUrl);
  returnUrl.searchParams.set("orderId", String(orderId));

  return returnUrl.toString();
}

function normalizeOrderId(orderId) {
  if (!orderId) return null;

  if (typeof orderId === "string") return orderId;

  if (typeof orderId.toString === "function") {
    const value = orderId.toString();
    return value === "[object Object]" ? null : value;
  }

  return null;
}

function normalizeAmount(amount) {
  const numberAmount = Number(amount);

  if (!Number.isFinite(numberAmount) || numberAmount <= 0) {
    throw new Error("Payme amount noto'g'ri");
  }

  return Math.round(numberAmount * 100);
}

function buildPaymeUrl(orderId, amount) {
  getRequiredRedirectConfig();

  const normalizedOrderId = normalizeOrderId(orderId);

  if (!normalizedOrderId) {
    throw new Error("Payme orderId berilmagan");
  }

  const amountInTiyin = normalizeAmount(amount);
  const accountKey = paymeConfig.ACCOUNT_KEY || "order_id";

  const params = [
    `m=${paymeConfig.KASSA_ID}`,
    `ac.${accountKey}=${normalizedOrderId}`,
    `a=${amountInTiyin}`,
    `l=uz`,
    `c=${getReturnUrl(normalizedOrderId)}`,
  ].join(";");

  const encodedParams = Buffer.from(params, "utf8").toString("base64");

  return `${paymeConfig.CHECKOUT_URL}/${encodeURIComponent(encodedParams)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPaymeCheckoutForm(order) {
  if (!order || !order._id) {
    throw new Error("Payme order berilmagan");
  }

  const paymeUrl = buildPaymeUrl(order._id.toString(), order.totalAmount);
  const safePaymeUrl = escapeHtml(paymeUrl);

  return `<!doctype html>
<html lang="uz">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="0;url=${safePaymeUrl}">
    <title>Payme</title>
  </head>
  <body>
    <script>window.location.replace(${JSON.stringify(paymeUrl)});</script>
    <a href="${safePaymeUrl}">Payme orqali to'lash</a>
  </body>
</html>`;
}

function getPublicBaseUrl() {
  return (
    process.env.API_PUBLIC_URL ||
    process.env.SERVER_URL ||
    "http://localhost:5000"
  ).replace(/\/+$/, "");
}

function buildPaymeCheckoutUrl(orderId) {
  const normalizedOrderId = normalizeOrderId(orderId);

  if (!normalizedOrderId) {
    throw new Error("Payme orderId berilmagan");
  }

  return `${getPublicBaseUrl()}/api/v1/payme/checkout/${encodeURIComponent(
    normalizedOrderId,
  )}`;
}

module.exports = {
  buildPaymeUrl,
  buildPaymeCheckoutUrl,
  buildPaymeCheckoutForm,
};
