const express = require("express");
const router = express.Router();
const settingsController = require("../../controllers/admin/settingsController");
const { protect, restrictTo } = require("../../middlewares/auth");

router.use(protect, restrictTo("admin"));

router.get("/delivery", settingsController.getDeliverySettings);
router.put("/delivery", settingsController.updateDeliverySettings);

module.exports = router;
