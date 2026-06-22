const Faq = require("../../models/Faq");
const apiResponse = require("../../utils/apiResponse");

exports.getFaqs = async (req, res, next) => {
  try {
    const faqs = await Faq.find({ isActive: true })
      .sort({
        order: 1,
        createdAt: -1,
      })
      .lean();

    return apiResponse(res, 200, true, "Faq list", faqs);
  } catch (error) {
    next(error);
  }
};
