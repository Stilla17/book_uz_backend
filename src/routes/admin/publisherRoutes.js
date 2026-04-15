const express = require("express");
const router = express.Router();
const publisherController = require("../../controllers/admin/publisherController");
const { protect, restrictTo } = require("../../middlewares/auth");
const upload = require("../../middlewares/upload");

router.use(protect, restrictTo("admin"));

router.get("/", publisherController.getPublishers);
router.get("/:id", publisherController.getOne);
router.post("/", upload.single("image"), publisherController.createPublisher);
router.patch("/:id", upload.single("image"), publisherController.updatePublisher);
router.delete("/:id", publisherController.deletePublisher);

module.exports = router;
