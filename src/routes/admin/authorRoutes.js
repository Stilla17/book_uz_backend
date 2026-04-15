const express = require('express');
const router = express.Router();
const authorController = require('../../controllers/admin/authorController');
const { protect, restrictTo } = require('../../middlewares/auth');
const upload = require('../../middlewares/upload'); // Muallif rasmini yuklash uchun

/**
 * XAVFSIZLIK: Faqat Login qilgan va roli 'admin' bo'lganlar kira oladi
 */
router.use(protect, restrictTo('admin'));

/**
 * MUALLIFLARNI BOSHQARISH (CRUD)
 */

// GET /api/v1/admin/authors - Barcha mualliflar (Search va Pagination bilan)
router.get('/', authorController.getAllAuthorsAdmin);

// GET /api/v1/admin/authors/:id - Muallif statistikasi va kitoblari
router.get('/:id', authorController.getAuthorDetailsAdmin);

// POST /api/v1/admin/authors - Yangi muallif qo'shish (Rasm bilan)
router.post('/', upload.single('image'), authorController.createAuthor);

// PATCH /api/v1/admin/authors/:id - Muallifni tahrirlash (Rasm ham yangilanishi mumkin)
router.patch('/:id', upload.single('image'), authorController.updateAuthor);

// DELETE /api/v1/admin/authors/:id - Muallifni o'chirish
router.delete('/:id', authorController.deleteAuthor);

module.exports = router;