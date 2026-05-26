const express = require("express");
const router = express.Router();

const paymeAuth = require("../middlewares/paymeAuth");
const { paymeCheckout, paymeWebhook } = require("../controllers/paymeController");

router.get("/checkout/:orderId", paymeCheckout);
router.post("/", paymeAuth, paymeWebhook);

module.exports = router;
