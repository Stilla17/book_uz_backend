const express = require("express");
const { protect, restrictTo } = require("../../middlewares/auth");
const {
  scanCashbackQr,
} = require("../../controllers/admin/cashbackController");

const router = express.Router();

router.use(protect, restrictTo("ADMIN", "SUPERADMIN"));

router.post("/scan", scanCashbackQr);

module.exports = router;
