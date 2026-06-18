const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth/authController");

/**
 * AUTH YO'LLARI (Public - hamma uchun ochiq)
 */

// 1. Ro'yxatdan o'tish: POST /api/v1/auth/register
router.post("/register", authController.register);

// 2. Tizimga kirish: POST /api/v1/auth/login
router.post("/login", authController.login);

// Telefon raqam va ism familya orqali OTPsiz kirish: POST /api/v1/auth/phone/login
router.post("/phone/login", authController.loginWithPhone);

// Telefon raqam orqali OTP yuborish: POST /api/v1/auth/phone/send-otp
router.post("/phone/send-otp", authController.sendPhoneOtp);

// Telefon OTP tasdiqlash va login: POST /api/v1/auth/phone/verify-otp
router.post("/phone/verify-otp", authController.verifyPhoneOtp);

// 3. Tokenni yangilash: POST /api/v1/auth/refresh
router.post("/refresh", authController.refresh);

// 4. Tizimdan chiqish: POST /api/v1/auth/logout
router.post("/logout", authController.logout);

// MUHIM: Routerni eksport qilishni unutmang!
module.exports = router;
