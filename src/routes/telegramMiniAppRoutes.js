const express = require("express");
const {
  createMiniAppSession,
  getMiniAppCashback,
  createCashbackQr,
} = require("../controllers/user/telegramMiniAppController");

const router = express.Router();

router.post("/session", createMiniAppSession);
router.get("/cashback", getMiniAppCashback);
router.post("/cashback/qr", createCashbackQr);

module.exports = router;
