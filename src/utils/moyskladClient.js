const DEFAULT_BASE_URL = "https://api.moysklad.ru/api/remap/1.2";
const RETRY_DELAYS_MS = [5000, 15000, 30000, 60000];
const DEFAULT_REQUEST_CONCURRENCY = 2;
const MAX_REQUEST_CONCURRENCY = 4;

const configuredConcurrency = Number.parseInt(
  process.env.MOYSKLAD_REQUEST_CONCURRENCY,
  10,
);
const requestConcurrency = Math.min(
  Math.max(configuredConcurrency || DEFAULT_REQUEST_CONCURRENCY, 1),
  MAX_REQUEST_CONCURRENCY,
);

let activeRequestCount = 0;
const pendingRequests = [];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const acquireRequestSlot = () =>
  new Promise((resolve) => {
    if (activeRequestCount < requestConcurrency) {
      activeRequestCount += 1;
      resolve();
      return;
    }

    pendingRequests.push(resolve);
  });

const releaseRequestSlot = () => {
  const nextRequest = pendingRequests.shift();

  if (nextRequest) {
    nextRequest();
    return;
  }

  activeRequestCount = Math.max(activeRequestCount - 1, 0);
};

const runWithMoyskladLimit = async (requestFn) => {
  await acquireRequestSlot();

  try {
    return await requestFn();
  } finally {
    releaseRequestSlot();
  }
};

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

const getMoyskladErrorCode = (error) =>
  error.response?.data?.errors?.[0]?.code;

const getMoyskladErrorMessage = (error) =>
  error.response?.data?.errors?.[0]?.error || error.message;

const logMoyskladError = (label, error) => {
  const status = getAxiosStatus(error);
  console.error(`${label}: ${status || "NO_STATUS"} - ${getMoyskladErrorMessage(error)}`);
};

const getResponseHeader = (error, headerName) => {
  const responseHeaders = error.response?.headers;
  if (!responseHeaders) return undefined;

  if (typeof responseHeaders.get === "function") {
    return responseHeaders.get(headerName);
  }

  return (
    responseHeaders[headerName] ||
    responseHeaders[headerName.toLowerCase()] ||
    responseHeaders[headerName.toUpperCase()]
  );
};

const getRetryDelayMs = (error, fallbackMs) => {
  const retryAfter =
    getResponseHeader(error, "X-Lognex-Retry-After") ??
    getResponseHeader(error, "X-Lognex-Reset");
  const retryAfterMs = Number(retryAfter);
  const baseDelay =
    Number.isFinite(retryAfterMs) && retryAfterMs >= 0
      ? Math.max(retryAfterMs, 250)
      : fallbackMs;

  return baseDelay + Math.floor(Math.random() * 250);
};

const requestWithRetry = async (
  requestFn,
  label,
  retryDelaysMs = RETRY_DELAYS_MS,
) => {
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      return await runWithMoyskladLimit(requestFn);
    } catch (error) {
      const isRateLimitError =
        getAxiosStatus(error) === 429 || getMoyskladErrorCode(error) === 1073;
      const canRetry =
        isRateLimitError && attempt < retryDelaysMs.length;
      if (!canRetry) throw error;

      const waitMs = getRetryDelayMs(error, retryDelaysMs[attempt]);
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
  getMoyskladErrorCode,
  getMoyskladErrorMessage,
  logMoyskladError,
  runWithMoyskladLimit,
  requestWithRetry,
  cleanBarcode,
  getMoyskladBarcode,
  formatMoyskladDate,
};
