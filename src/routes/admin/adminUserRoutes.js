const express = require("express");
const router = express.Router();
const adminUserController = require("../../controllers/admin/userController");
const {
  exportUsersExcel,
} = require("../../controllers/admin/userExportExelController");
const { protect, restrictTo } = require("../../middlewares/auth");

router.use(protect, restrictTo("admin"));

router.get("/", adminUserController.getAllUsersAdmin);
router.post("/", adminUserController.createUserAdmin);
router.get("/export-excel", exportUsersExcel);
router.get("/:id", adminUserController.getUserFullDetailsAdmin);
router.patch("/:id", adminUserController.updateUserAdmin);
router.put("/:id", adminUserController.updateUserAdmin);
router.patch("/:id/update", adminUserController.updateUserAdmin);
router.patch("/:id/reset-password", adminUserController.resetUserPasswordAdmin);
router.delete("/:id", adminUserController.deleteUserAdmin);

module.exports = router;
