const express = require("express");
const router = express.Router();
const productController = require("../../controllers/user/productController");
const { optionalProtect } = require("../../middlewares/auth");

// 1. Asosiy ro'yxat (Hamma filtrlar shu yerda ishlaydi)
router.get("/", optionalProtect, productController.getAllProducts);

// 2. Random kitoblar (Asosiy sahifa uchun)
router.get("/random", optionalProtect, productController.getRandomProducts);

// 3. Yangi kelganlar (Asosiy sahifa uchun)
router.get("/new-arrivals", optionalProtect, productController.getNewArrivals);

// Kop korilgan kitoblar oldinga chiqadi.
router.get("/most-viewed", optionalProtect, productController.getMostViewed);

// Kitob ko'rilganda bazadagi hisoblagichni atomik oshirish
router.post("/:id/view", productController.trackProductView);

// 4. Bitta mahsulot tafsiloti
router.get("/:id", optionalProtect, productController.getProductById);

// 5. O'xshash kitoblar (Kitob ichiga kirganda pastida chiqishi uchun)
router.get(
  "/:id/related",
  optionalProtect,
  productController.getRelatedProducts,
);

module.exports = router;
