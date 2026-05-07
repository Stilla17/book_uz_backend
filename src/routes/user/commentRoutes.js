const express = require("express");
const router = express.Router();

const {
  createComment,
  getCommentsByBook,
} = require("../../controllers/user/commentController");
const { protect } = require("../../middlewares/auth");

// comment qo‘shish
router.post("/", protect, createComment);

// kitob commentlarini olish
router.get("/book/:bookId", getCommentsByBook);

module.exports = router;
