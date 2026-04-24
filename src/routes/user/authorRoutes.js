const express = require('express');
const router = express.Router();
const authorController = require('../../controllers/user/authorController');

router.get('/', authorController.getAllAuthors);
router.get('/:id/products', authorController.getAuthorProducts);
router.get('/:id', authorController.getAuthorByIdOrSlug);

module.exports = router;
