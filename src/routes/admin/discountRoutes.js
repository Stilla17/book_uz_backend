const express = require("express");
const router = express.Router();
const discountController = require("../../controllers/admin/discountController");
const { protect, restrictTo } = require("../../middlewares/auth");

router.use(protect, restrictTo("ADMIN"));

router.post("/", discountController.createDiscount);
router.get("/", discountController.getAllDiscounts);
router.get("/:id", discountController.getDiscountById);
router.put("/:id", discountController.updateDiscount);
router.patch("/:id", discountController.updateDiscount);
router.delete("/:id", discountController.deleteDiscount);

module.exports = router;
