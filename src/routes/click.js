const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");

const {
  clickPrepare,
  clickComplete,
  createOrder,
  getOrderStatus,
} = require("../controllers/clickController");

// ─── Click webhook endpointlar (Click.uz bu URL larga POST yuboradi) ──────────
router.post("/prepare", clickPrepare);
router.post("/complete", clickComplete);

// ─── Frontend tomonidan ishlatiladigan endpointlar ────────────────────────────
router.post("/create-order", protect, createOrder);
router.get("/order-status/:orderId", protect, getOrderStatus);

module.exports = router;
