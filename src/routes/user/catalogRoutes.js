const express = require("express");

const catalogController = require(
  "../../controllers/admin/catalogController",
);

const router = express.Router();

router.get("/", catalogController.getActiveCatalogs);
router.get("/:id", catalogController.getActiveCatalogById);

module.exports = router;
