const express = require("express");
const router = express.Router();
const faqController = require("../../controllers/user/faqController");

router.get("/", faqController.getFaqs);

module.exports = router;
