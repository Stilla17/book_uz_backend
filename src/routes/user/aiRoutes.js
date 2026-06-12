const express = require("express");
const aiController = require("../../controllers/user/aiController");

const router = express.Router();

router.post("/chat", aiController.chat);

module.exports = router;
