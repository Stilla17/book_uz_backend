const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth/authController'); 
const otpController = require('../controllers/auth/otpController');

/**
 * AUTH YO'LLARI (Public - hamma uchun ochiq)
 */

// 1. Ro'yxatdan o'tish: POST /api/v1/auth/register
router.post('/register', authController.register);

// 2. Tizimga kirish: POST /api/v1/auth/login
router.post('/login', authController.login);

// 3. Tokenni yangilash: POST /api/v1/auth/refresh
router.post('/refresh', authController.refresh);

// 4. Tizimdan chiqish: POST /api/v1/auth/logout
router.post('/logout', authController.logout);

router.post('/forgot-password', otpController.forgotPassword);
router.post('/reset-password', otpController.resetPassword);

// MUHIM: Routerni eksport qilishni unutmang!
module.exports = router;