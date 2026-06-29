const Comment = require("../../models/Comment");
const Product = require("../../models/Product");
const User = require("../../models/User");
const { buildSearchRegex, normalizeSearchText } = require("../../utils/searchRegex");

const buildCommentSearchFilter = async (value) => {
  const search = normalizeSearchText(value);
  if (!search) return {};

  const searchRegex = buildSearchRegex(search);
  const [books, users] = await Promise.all([
    Product.find({
      $or: [
        { "title.uz": searchRegex },
        { "title.ru": searchRegex },
        { "title.en": searchRegex },
        { barcode: searchRegex },
      ],
    }).select("_id"),
    User.find({
      $or: [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ],
    }).select("_id"),
  ]);

  const filters = [
    { name: searchRegex },
    { text: searchRegex },
  ];

  const bookIds = books.map((book) => book._id);
  if (bookIds.length) {
    filters.push({ book: { $in: bookIds } });
  }

  const userIds = users.map((user) => user._id);
  if (userIds.length) {
    filters.push({ user: { $in: userIds } });
  }

  return { $or: filters };
};

exports.getAllComments = async (req, res) => {
  try {
    const filter = await buildCommentSearchFilter(req.query.search || req.query.q);

    const comments = await Comment.find(filter)
      .populate("book", "title slug")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: comments,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCommentStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const comment = await Comment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );

    res.status(200).json({
      success: true,
      data: comment,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    await Comment.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Comment o‘chirildi",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
