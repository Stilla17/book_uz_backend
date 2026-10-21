const express = require("express");

const catalogController = require("../../controllers/admin/catalogController");

const { protect, restrictTo } = require("../../middlewares/auth");

const uploadBookImage = require("../../middlewares/uploadBookImage");

const router = express.Router();

router.use(protect, restrictTo("admin"));

router.get("/", catalogController.getAllCatalogs);
router.post("/sync", catalogController.syncCatalogPrices);
router.get("/:id", catalogController.getCatalogById);

router.post(
  "/",
  uploadBookImage.single("image"),
  catalogController.createCatalog,
);
router.patch(
  "/:id",
  uploadBookImage.single("image"),
  catalogController.updateCatalog,
);
router.patch("/:id/toggle-status", catalogController.toggleCatalogStatus);

router.delete("/:id", catalogController.deleteCatalog);

module.exports = router;
