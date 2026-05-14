const Publisher = require("../../models/Publisher");
const Product = require("../../models/Product");
const apiResponse = require("../../utils/apiResponse");
const slugify = require("../../utils/slugify");

const parseMaybeJson = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  return value;
};

const buildPublisherQuery = (idOrSlug) => {
  if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
    return { _id: idOrSlug };
  }

  return { slug: idOrSlug };
};

const getPublisherBooksCount = async (publisher) => {
  const publisherBookIds = Array.isArray(publisher.books) ? publisher.books : [];

  return Product.countDocuments({
    $or: [
      { publisher: publisher._id },
      ...(publisherBookIds.length ? [{ _id: { $in: publisherBookIds } }] : []),
    ],
  });
};

// Yaratish Post
exports.createPublisher = async (req, res) => {
  try {
    const { name, description } = req.body;
    const slug = slugify(name);
    const image = req.file ? req.file.path : "";

    const publisher = await Publisher.create({
      name,
      description,
      slug,
      image,
    });

    res.status(201).json({ success: true, data: publisher });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// barcha nashryotlarni olish Get
exports.getPublishers = async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const normalizedLimit = Math.min(Number(limit) || 50, 100);
    const normalizedPage = Number(page) || 1;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const filter = {};
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const [publishers, total] = await Promise.all([
      Publisher.find(filter)
        .sort("name")
        .skip(skip)
        .limit(normalizedLimit)
        .lean(),
      Publisher.countDocuments(filter),
    ]);

    const publishersWithBookCount = await Promise.all(
      publishers.map(async (publisher) => ({
        ...publisher,
        booksCount: await getPublisherBooksCount(publisher),
      })),
    );

    return apiResponse(res, 200, true, "Nashriyotlar ro'yxati", {
      publishers: publishersWithBookCount,
      pagination: {
        total,
        page: normalizedPage,
        pages: Math.ceil(total / normalizedLimit),
        limit: normalizedLimit,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// O'chirish Delete
exports.deletePublisher = async (req, res) => {
  try {
    const hasProducts = await Product.findOne({ publisher: req.params.id });
    if (hasProducts) {
      return res.status(400).json({
        success: false,
        message:
          "Bu nashriyotni o'chira olmaysiz, chunki unga bog'langan kitoblar mavjud",
      });
    }

    const publisher = await Publisher.findByIdAndDelete(req.params.id);
    if (!publisher) {
      return res
        .status(404)
        .json({ success: false, message: "Nashriyot topilmadi" });
    }
    res
      .status(200)
      .json({ success: true, message: "Nashriyot muvaffaqiyatli o'chirildi" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Yangilash Put
exports.updatePublisher = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (req.file) {
      updateData.image = req.file.path;
    }
    if (req.body.name && !req.body.slug) {
      updateData.slug = slugify(req.body.name);
    }

    const publisher = await Publisher.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    );
    if (!publisher)
      return res.status(404).json({ success: false, message: "Topilmadi" });
    res.status(200).json({ success: true, data: publisher });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// bitta nashryotni olish Kitob bilan Get
exports.getOne = async (req, res) => {
  try {
    const publisher = await Publisher.findOne(buildPublisherQuery(req.params.id)).lean();

    if (!publisher)
      return apiResponse(res, 404, false, "Nashriyot topilmadi");

    const booksCount = await getPublisherBooksCount(publisher);

    return apiResponse(res, 200, true, "Nashriyot ma'lumotlari", {
      ...publisher,
      booksCount,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

