const toId = (value) => {
  if (!value) return null;
  return value._id ? value._id.toString() : value.toString();
};

const hasRules = (coupon) =>
  coupon.applicableProducts?.length || coupon.applicablePublishers?.length;

const isProductApplicable = (coupon, product) => {
  if (!hasRules(coupon)) return true;
  if (!product) return false;

  const productId = toId(product);
  const publisherId = toId(product.publisher);

  const productIds = (coupon.applicableProducts || []).map(toId);
  const publisherIds = (coupon.applicablePublishers || []).map(toId);

  return productIds.includes(productId) || publisherIds.includes(publisherId);
};

const getItemPrice = (item) => {
  const product = item.product;
  if (product?.discountPrice > 0) return Number(product.discountPrice);
  if (product?.price !== undefined) return Number(product.price);
  return Number(item.price || 0);
};

const getCouponValue = (coupon) =>
  Number(coupon.value ?? coupon.discountPercentage ?? 0);

const calculateCouponDiscount = (coupon, items = []) => {
  const eligibleSubtotal = items.reduce((total, item) => {
    if (!isProductApplicable(coupon, item.product)) return total;

    const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
    return total + getItemPrice(item) * quantity;
  }, 0);

  const couponValue = getCouponValue(coupon);
  const discountAmount =
    coupon.type === "FIXED"
      ? Math.min(couponValue, eligibleSubtotal)
      : (eligibleSubtotal * couponValue) / 100;

  return {
    eligibleSubtotal,
    discountAmount,
  };
};

module.exports = {
  calculateCouponDiscount,
  getCouponValue,
  isProductApplicable,
};
