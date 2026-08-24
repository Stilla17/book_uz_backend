const RETAIL_STORE_NAME_PATTERN = /^[1-9]\d*(?:\s|$)/;

const isRetailStore = (branchStock = {}) =>
  RETAIL_STORE_NAME_PATTERN.test(String(branchStock.storeName || "").trim());

const calculateRetailStock = (branchStocks = []) =>
  Math.max(
    branchStocks
      .filter(isRetailStore)
      .reduce((total, item) => total + Number(item.available || 0), 0),
    0,
  );

module.exports = {
  calculateRetailStock,
  isRetailStore,
};
