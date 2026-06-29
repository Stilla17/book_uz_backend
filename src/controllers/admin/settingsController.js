const apiResponse = require("../../utils/apiResponse");
const {
  getDeliveryFee,
  updateDeliveryFee,
} = require("../../services/storeSettingsService");

const getDeliverySettings = async (req, res, next) => {
  try {
    const deliveryFee = await getDeliveryFee();

    apiResponse(res, 200, true, "Yetkazib berish sozlamalari", {
      deliveryFee,
    });
  } catch (error) {
    next(error);
  }
};

const updateDeliverySettings = async (req, res, next) => {
  try {
    const deliveryFee = await updateDeliveryFee(req.body.deliveryFee);

    apiResponse(res, 200, true, "Yetkazib berish narxi yangilandi", {
      deliveryFee,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDeliverySettings,
  updateDeliverySettings,
};
