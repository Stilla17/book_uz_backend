const express = require("express");
const router = express.Router();

const faqController = require("../../controllers/admin/faqController");
const { protect, restrictTo } = require("../../middlewares/auth");

router.use(protect, restrictTo("admin"));

router.get("/", faqController.getFaqs);
router.get("/:id", faqController.getFaqById);
router.post("/", faqController.createFaq);
router.patch("/:id", faqController.updateFaq);
router.delete("/:id", faqController.deleteFaq);

module.exports = router;
