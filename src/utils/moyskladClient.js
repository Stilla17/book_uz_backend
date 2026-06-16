const DEFAULT_BASE_URL = "https://api.moysklad.ru/api/remap/1.2";
const RETRY_DELAYS_MS = [5000, 15000, 30000];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getMoyskladBaseUrl = (apiUrl = process.env.MOYSKLAD_API_URL) => {
  if (!apiUrl) return DEFAULT_BASE_URL;

  const marker = "/api/remap/1.2";
  const markerIndex = apiUrl.indexOf(marker);

  if (markerIndex === -1) {
    return apiUrl.replace(/\/entity\/.*$/, "");
  }

  return apiUrl.slice(0, markerIndex + marker.length);
};

const moyskladHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/json;charset=utf-8",
  "Cache-Control": "no-cache",
});

const getAxiosStatus = (error) => error.response?.status;

const getMoyskladErrorMessage = (error) =>
  error.response?.data?.errors?.[0]?.error || error.message;

const logMoyskladError = (label, error) => {
  const status = getAxiosStatus(error);
  console.error(`${label}: ${status || "NO_STATUS"} - ${getMoyskladErrorMessage(error)}`);
};

const requestWithRetry = async (
  requestFn,
  label,
  retryDelaysMs = RETRY_DELAYS_MS,
) => {
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      return await requestFn();
    } catch (error) {
      const canRetry = getAxiosStatus(error) === 429 && attempt < retryDelaysMs.length;
      if (!canRetry) throw error;

      const waitMs = retryDelaysMs[attempt];
      console.warn(`${label}: MoySklad limitiga urildi, ${Math.round(waitMs / 1000)} sekund kutamiz...`);
      await delay(waitMs);
    }
  }

  return null;
};

const cleanBarcode = (barcode) => barcode?.toString().replace(/\D/g, "") || "";

const getMoyskladBarcode = (assortment = {}) => {
  const barcodes = assortment.barcodes || [];

  for (const barcode of barcodes) {
    const value = barcode.ean13 || barcode.ean8 || barcode.code128 || barcode.gtin || Object.values(barcode)[0];
    if (value) return cleanBarcode(value);
  }

  return cleanBarcode(assortment.barcode || assortment.code || assortment.article);
};

const formatMoyskladDate = (date, endOfDay = false) => {
  const pad = (value) => String(value).padStart(2, "0");
  const hours = endOfDay ? "23:59:59" : "00:00:00";

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hours}`;
};

module.exports = {
  DEFAULT_BASE_URL,
  delay,
  getMoyskladBaseUrl,
  moyskladHeaders,
  getAxiosStatus,
  getMoyskladErrorMessage,
  logMoyskladError,
  requestWithRetry,
  cleanBarcode,
  getMoyskladBarcode,
  formatMoyskladDate,
};
