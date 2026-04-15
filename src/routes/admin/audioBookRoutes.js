const express = require('express');
const router = express.Router();
const audioBookController = require('../../controllers/admin/audioBookController');
const { protect, restrictTo } = require('../../middlewares/auth');
const upload = require('../../middlewares/upload');

// Multiple file upload - audio uchun maxsus
const uploadFields = upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'audioFile', maxCount: 1 }
]);

// Debug: router ga kirishda
router.use((req, res, next) => {
  console.log(`📡 ${req.method} /admin/audio-books${req.path}`);
  next();
});

router.use(protect, restrictTo('admin'));

router.get('/', audioBookController.getAllAudioBooks);
router.get('/:id', audioBookController.getAudioBookById);
router.post('/', (req, res, next) => {
  uploadFields(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.log('Files uploaded successfully');
    console.log('req.files:', req.files);
    console.log('req.body:', req.body);
    audioBookController.createAudioBook(req, res, next);
  });
});
router.patch('/:id', uploadFields, audioBookController.updateAudioBook);
router.delete('/:id', audioBookController.deleteAudioBook);
router.patch('/:id/toggle-status', audioBookController.toggleAudioBookStatus);
router.patch('/:id/toggle-hit', audioBookController.toggleHitStatus);
router.patch('/:id/toggle-new', audioBookController.toggleNewStatus);

module.exports = router;