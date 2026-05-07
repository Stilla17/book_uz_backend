const express = require('express');
const router = express.Router();

const {
  getAllComments,
  updateCommentStatus,
  deleteComment
} = require('../../controllers/admin/adminCommentController');

const { protect, restrictTo } = require('../../middlewares/auth');

router.use(protect, restrictTo('admin'));

router.get('/', getAllComments);
router.patch('/:id/status', updateCommentStatus);
router.delete('/:id', deleteComment);

module.exports = router;
