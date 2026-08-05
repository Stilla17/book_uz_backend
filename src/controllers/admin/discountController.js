const Discount = require("../../models/Discount");
const apiResponse = require("../../utils/apiResponse");

const buildDiscountPayload = (body) => {
  const {
    name,
    type,
    value,
    discountPercentage,
    targetType,
    products,
    publishers,
    minOrderAmount,
    startDate,
    endDate,
    isActive,
  } = body;

  const payload = {};

  if (name !== undefined) payload.name = name;
  if (type !== undefined) payload.type = type;
  if (value !== undefined) payload.value = value;
  if (discountPercentage !== undefined) payload.value = discountPercentage;
  if (targetType !== undefined) payload.targetType = targetType;
  if (products !== undefined) payload.products = products;
  if (publishers !== undefined) payload.publishers = publishers;
  if (minOrderAmount !== undefined) payload.minOrderAmount = minOrderAmount;
  if (startDate !== undefined) payload.startDate = startDate;
  if (endDate !== undefined) payload.endDate = endDate;
  if (isActive !== undefined) payload.isActive = isActive;

  return payload;
};

const createDiscount = async (req, res, next) => {
  try {
    const discount = await Discount.create(buildDiscountPayload(req.body));

    apiResponse(res, 201, true, "Chegirma muvaffaqiyatli yaratildi", discount);
  } catch (error) {
    next(error);
  }
};

const getAllDiscounts = async (req, res, next) => {
  try {
    const discounts = await Discount.find()
      .populate("products", "title slug price discountPrice image")
      .populate("publishers", "name slug image")
      .sort("-createdAt");
    apiResponse(
      res,
      200,
      true,
      "Barcha chegirmalar muvaffaqiyatli olindi",
      discounts,
    );
  } catch (error) {
    next(error);
  }
};

const getDiscountById = async (req, res, next) => {
  try {
    const discount = await Discount.findById(req.params.id)
      .populate("products", "title slug price discountPrice image")
      .populate("publishers", "name slug image");

    if (!discount) {
      return apiResponse(res, 404, false, "Chegirma topilmadi");
    }

    apiResponse(res, 200, true, "Chegirma muvaffaqiyatli olindi", discount);
  } catch (error) {
    next(error);
  }
};

const deleteDiscount = async (req, res, next) => {
  try {
    const discount = await Discount.findByIdAndDelete(req.params.id);

    if (!discount) {
      return apiResponse(res, 404, false, "Chegirma topilmadi");
    }

    apiResponse(res, 200, true, "Chegirma muvaffaqiyatli o'chirildi");
  } catch (error) {
    next(error);
  }
};

const updateDiscount = async (req, res, next) => {
  try {
    const discount = await Discount.findById(req.params.id);

    if (!discount) {
      return apiResponse(res, 404, false, "Chegirma topilmadi");
    }

    discount.set(buildDiscountPayload(req.body));
    await discount.save();

    apiResponse(res, 200, true, "Chegirma muvaffaqiyatli yangilandi", discount);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDiscount,
  getAllDiscounts,
  getDiscountById,
  deleteDiscount,
  updateDiscount,
};
