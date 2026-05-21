const express = require('express');
const router = express.Router();
const newsController = require('../../controllers/user/newsController');

router.get('/', newsController.getAllNews);
router.get('/:slug', newsController.getNewsBySlug);
router.post('/:id/view', newsController.trackNewsView);

module.exports = router;
