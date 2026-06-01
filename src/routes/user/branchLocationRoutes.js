const express = require("express");
const router = express.Router();
const branchLocationController = require("../../controllers/user/branchLocationController");

router.get("/", branchLocationController.getBranchLocations);

module.exports = router;
