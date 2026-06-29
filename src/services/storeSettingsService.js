const StoreSetting = require("../models/StoreSetting");

const DEFAULT_DELIVERY_FEE = 20000;
const DELIVERY_FEE_KEY = "deliveryFee";

const normalizeDeliveryFee = (value) => {
  const deliveryFee = Number(value);

  if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
    return null;
  }

  return Math.round(deliveryFee);
};

const getDeliveryFee = async () => {
  const setting = await StoreSetting.findOne({ key: DELIVERY_FEE_KEY }).lean();
  const deliveryFee = normalizeDeliveryFee(setting?.value);

  return deliveryFee ?? DEFAULT_DELIVERY_FEE;
};

const updateDeliveryFee = async (value) => {
  const deliveryFee = normalizeDeliveryFee(value);

  if (deliveryFee === null) {
    const error = new Error("Yetkazib berish narxi noto'g'ri");
    error.statusCode = 400;
    throw error;
  }

  await StoreSetting.findOneAndUpdate(
    { key: DELIVERY_FEE_KEY },
    { $set: { value: deliveryFee } },
    { upsert: true, new: true },
  );

  return deliveryFee;
};

module.exports = {
  DEFAULT_DELIVERY_FEE,
  getDeliveryFee,
  updateDeliveryFee,
};
