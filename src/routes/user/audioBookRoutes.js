const express = require('express');
const router = express.Router();
const audioBookController = require('../../controllers/user/audioBookController');

// Public routes
router.get('/', audioBookController.getActiveAudioBooks);
router.get('/:id', audioBookController.getAudioBookById);
router.get('/slug/:slug', audioBookController.getAudioBookBySlug);
router.post('/:id/download', audioBookController.incrementDownload);

module.exports = router;