const Discount = require("../models/Discount");

const toId = (value) => {
  if (!value) return null;
  if (value._id) return value._id.toString();
  return value.toString();
};

const getActiveDiscounts = () => {
  const now = new Date();

  return Discount.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  }).lean();
};

const calculatePriceByDiscount = (price, discount) => {
  const numericPrice = Number(price || 0);
  const value = Number(discount.value || 0);

  if (numericPrice <= 0 || value <= 0) return numericPrice;

  if (discount.type === "FIXED") {
    return Math.max(0, Math.round(numericPrice - value));
  }

  return Math.max(0, Math.round(numericPrice - (numericPrice * value) / 100));
};

const isDiscountApplicable = (product, discount) => {
  const productId = toId(product._id || product.id);
  const publisherId = toId(product.publisher);

  if (discount.targetType === "PRODUCTS") {
    return (discount.products || []).some((id) => toId(id) === productId);
  }

  if (discount.targetType === "PUBLISHERS") {
    return (discount.publishers || []).some((id) => toId(id) === publisherId);
  }

  return false;
};

const applyDiscountToProduct = (product, discounts = []) => {
  const productObject =
    typeof product.toObject === "function" ? product.toObject() : { ...product };
  const price = Number(productObject.price || 0);
  const existingDiscountPrice = Number(productObject.discountPrice || 0);

  let bestDiscount = null;
  let bestDiscountPrice =
    existingDiscountPrice > 0 && existingDiscountPrice < price
      ? existingDiscountPrice
      : price;

  discounts.forEach((discount) => {
    if (!isDiscountApplicable(productObject, discount)) return;

    const discountPrice = calculatePriceByDiscount(price, discount);
    if (discountPrice < bestDiscountPrice) {
      bestDiscountPrice = discountPrice;
      bestDiscount = discount;
    }
  });

  const isDiscount = bestDiscountPrice > 0 && bestDiscountPrice < price;

  return {
    ...productObject,
    discountPrice: isDiscount ? bestDiscountPrice : 0,
    isDiscount,
    activeDiscount: bestDiscount
      ? {
          _id: bestDiscount._id,
          name: bestDiscount.name,
          type: bestDiscount.type,
          value: bestDiscount.value,
          targetType: bestDiscount.targetType,
          minOrderAmount: bestDiscount.minOrderAmount || 0,
          startDate: bestDiscount.startDate,
          endDate: bestDiscount.endDate,
        }
      : null,
  };
};

const applyDiscountsToProducts = (products, discounts = []) => {
  const isList = Array.isArray(products);
  const productList = isList ? products : [products];
  const discountedProducts = productList.map((product) =>
    applyDiscountToProduct(product, discounts),
  );

  return isList ? discountedProducts : discountedProducts[0];
};

const applyActiveDiscountsToProducts = async (products) => {
  const discounts = await getActiveDiscounts();
  return applyDiscountsToProducts(products, discounts);
};

const getEffectiveProductPrice = async (product) => {
  const discountedProduct = await applyActiveDiscountsToProducts(product);
  return discountedProduct.discountPrice > 0
    ? discountedProduct.discountPrice
    : discountedProduct.price;
};

module.exports = {
  applyActiveDiscountsToProducts,
  applyDiscountsToProducts,
  applyDiscountToProduct,
  getActiveDiscounts,
  getEffectiveProductPrice,
};
