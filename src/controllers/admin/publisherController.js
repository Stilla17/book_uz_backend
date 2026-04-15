const Publisher = require("../../models/Publisher");
const Product = require("../../models/Product");
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

// Yaratish Post
exports.createPublisher = async (req, res) => {
  try {
    const {name, description} = req.body;
    const slug = slugify(name);
    const image = req.file ? req.file.path : "";
    
    const publisher = await Publisher.create({
      name,
      description,
      slug,
      image
    });

    res.status(201).json({ success: true, data: publisher });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// barcha nashryotlarni olish Get
exports.getPublishers = async (req, res) => {
  try {
    const publishers = await Publisher.find()
      .populate({
        path: "books",
        select:
          "title slug images price discountPrice author category subCategoryId",
        populate: [
          { path: "author", select: "name" },
          { path: "category", select: "title subgenres" },
        ],
      })
      .sort("name");

    const data = publishers.map((publisher) => ({
      ...publisher.toObject(),
      booksCount: publisher.books?.length || 0,
    }));

    res.status(200).json({ success: true, data });
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
    const publisher = await Publisher.findById(req.params.id).populate({
      path: "books",
      select:
        "title slug images price discountPrice author category subCategoryId",
      populate: [
        { path: "author", select: "name" },
        { path: "category", select: "title subgenres" },
      ],
    });
    if (!publisher)
      return res.status(404).json({ success: false, message: "Topilmadi" });
    res.json({ success: true, data: publisher });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
