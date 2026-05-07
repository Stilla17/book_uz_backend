const Comment = require("../../models/Comment");

exports.createComment = async (req, res) => {
  try {
    const { bookId, name, text } = req.body;

    if (!bookId || !name || !text) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const comment = await Comment.create({
      book: bookId,
      user: req.user._id,
      name,
      text,
    });

    res.status(201).json({
      success: true,
      message: "Comment created successfully",
      data: comment,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getCommentsByBook = async (req, res) => {
  try {
    const { bookId } = req.params;
    const comments = await Comment.find({ book: bookId }).populate(
      "user",
      "name email",
    );
    res.status(200).json({
      success: true,
      data: comments,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
