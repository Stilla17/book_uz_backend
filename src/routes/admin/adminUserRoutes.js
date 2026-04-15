const express = require('express');
const router = express.Router();
const adminUserController = require('../../controllers/admin/userController');
const { protect, restrictTo } = require('../../middlewares/auth');


router.use(protect, restrictTo('admin'));

router.get('/', adminUserController.getAllUsersAdmin);
router.get('/:id', adminUserController.getUserFullDetailsAdmin);
router.patch('/:id/update', adminUserController.updateUserAdmin);
router.patch('/:id/reset-password', adminUserController.resetUserPasswordAdmin);
router.delete('/:id', adminUserController.deleteUserAdmin);

module.exports = router;