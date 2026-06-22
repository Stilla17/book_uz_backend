const Faq = require("../../models/Faq");
const apiResponse = require("../../utils/apiResponse");
const {
  getPaginationParams,
  buildPagination,
} = require("../../utils/pagination");
const { buildSearchRegex } = require("../../utils/searchRegex");

const createFaq = async (req, res, next) => {
  try {
    const faq = await Faq.create({
      question: req.body.question,
      answer: req.body.answer,
      isActive: req.body.isActive ?? true,
    });

    return apiResponse(res, 201, true, "FAQ created", faq);
  } catch (error) {
    next(error);
  }
};

const getFaqs = async (req, res, next) => {
  try {
    const { search, isActive } = req.query;
    const paginationParams = getPaginationParams(req.query, {
      limit: 20,
      maxLimit: 100,
    });

    const filter = {};

    if (search) {
      filter.$or = [
        { "question.uz": buildSearchRegex(search) },
        { "question.ru": buildSearchRegex(search) },
        { "question.en": buildSearchRegex(search) },
        { "answer.uz": buildSearchRegex(search) },
        { "answer.ru": buildSearchRegex(search) },
        { "answer.en": buildSearchRegex(search) },
      ];
    }

    if (isActive === "true") filter.isActive = true;
    if (isActive === "false") filter.isActive = false;

    const [faqs, total] = await Promise.all([
      Faq.find(filter)
        .sort({ createdAt: -1 })
        .skip(paginationParams.skip)
        .limit(paginationParams.limit)
        .lean(),
      Faq.countDocuments(filter),
    ]);

    return apiResponse(res, 200, true, "Faq lists", {
      faqs,
      pagination: buildPagination({ ...paginationParams, total }),
    });
  } catch (error) {
    next(error);
  }
};

const getFaqById = async (req, res, next) => {
  try {
    const faq = await Faq.findById(req.params.id).lean();

    if (!faq) {
      return apiResponse(res, 404, false, "FAQ topilmadi");
    }

    return apiResponse(res, 200, true, "FAQ data", faq);
  } catch (error) {
    next(error);
  }
};

const updateFaq = async (req, res, next) => {
  try {
    const updateData = {
      question: req.body.question,
      answer: req.body.answer,
      isActive: req.body.isActive,
    };

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const faq = await Faq.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!faq) {
      return apiResponse(res, 404, false, "FAQ topilmadi");
    }
    return apiResponse(res, 200, true, "FAQ yangilandi", faq);
  } catch (error) {
    next(error);
  }
};

const deleteFaq = async (req, res, next) => {
  try {
    const faq = await Faq.findByIdAndDelete(req.params.id);

    if (!faq) {
      return apiResponse(res, 404, false, "FAQ topilmadi");
    }

    return apiResponse(res, 200, true, "FAQ o'chirildi");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFaq,
  getFaqs,
  getFaqById,
  updateFaq,
  deleteFaq,
};
