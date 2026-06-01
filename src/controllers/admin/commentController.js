const Comment = require("../../models/Comment");

exports.getAllComments = async (req, res) => {
  try {
    const comments = await Comment.find()
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
