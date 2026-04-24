const express = require('express');
const router = express.Router();
const publisherController = require('../../controllers/user/publisherController');

router.get('/', publisherController.getAllPublishers);
router.get('/:id/products', publisherController.getPublisherProducts);
router.get('/:id', publisherController.getPublisherByIdOrSlug);

module.exports = router;
