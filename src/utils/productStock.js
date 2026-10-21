const hasUnlimitedStock = (product) =>
  product?.moyskladExternalCode?.toString().trim() === "-";

const hasEnoughStock = (product, quantity) =>
  Boolean(product) &&
  (hasUnlimitedStock(product) || Number(product.stock) >= Number(quantity));

module.exports = {
  hasUnlimitedStock,
  hasEnoughStock,
};
