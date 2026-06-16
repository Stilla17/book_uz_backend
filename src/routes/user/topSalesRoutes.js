const express = require("express");
const router = express.Router();
const topSalesController = require("../../controllers/user/topSalesController");
const { protect, restrictTo } = require("../../middlewares/auth");

router.get("/", topSalesController.getTopSales);
router.post("/sync", protect, restrictTo("admin"), topSalesController.syncTopSales);

module.exports = router;