const express = require("express");
const router = express.Router();
const settingsController = require("../../controllers/user/settingsController");

router.get("/delivery", settingsController.getDeliverySettings);

module.exports = router;
