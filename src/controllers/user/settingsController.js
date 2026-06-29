const apiResponse = require("../../utils/apiResponse");
const { getDeliveryFee } = require("../../services/storeSettingsService");

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

module.exports = {
  getDeliverySettings,
};
