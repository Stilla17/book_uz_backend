const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user/userController');
const { protect } = require('../../middlewares/auth');;
const upload = require('../../middlewares/upload'); 


router.use(protect);

/**
 * PROFIL MA'LUMOTLARI
 */
router.patch('/profile', upload.single('avatar'), userController.updateProfile);
router.patch('/update-profile', upload.single('avatar'), userController.updateProfile);
router.patch('/update-password', userController.updatePassword);    

/**
 * WISHLIST (SARALANGANLAR)
 */
router.get('/wishlist', userController.getWishlistDetails);
router.post('/wishlist/toggle', userController.toggleWishlist); 

/**
 * MANZILLAR (SHIPPING ADDRESS)
 */
router.get('/addresses', userController.getAddresses); 
router.post('/address', userController.addAddress);
router.delete('/address/:addressId', userController.deleteAddress);






/**
 * XABARNOMA SOZLAMALARI
 */
router.get('/notifications', userController.getNotificationSettings);
router.put('/notifications', userController.updateNotificationSettings);

/**
 * XAVFSIZLIK SOZLAMALARI
 */
router.get('/security', userController.getSecuritySettings);
router.put('/security', userController.updateSecuritySettings);

/**
 * TIL VA MINTAQA SOZLAMALARI
 */
router.get('/preferences', userController.getLanguageRegion);
router.put('/preferences', userController.updateLanguageRegion);

/**
 * QURILMALAR
 */
router.get('/devices', userController.getActiveDevices);
router.delete('/devices/:deviceId', userController.removeDevice);

/**
 * HISOBNI O'CHIRISH
 */
router.delete('/account', userController.deleteAccount);

module.exports = router;