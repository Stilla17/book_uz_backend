const express = require("express");
const router = express.Router();

const paymeAuth = require("../middlewares/paymeAuth");
const { paymeWebhook } = require("../controllers/paymeController");

router.post("/", paymeAuth, paymeWebhook);

module.exports = router;
