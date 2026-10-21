const multer = require("multer");
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const fileFilter = (req, file, callback) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    const error = new Error(
      "Faqat JPG, PNG yoki WEBP formatidagi rasm yuklash mumkin",
    );
    error.statusCode = 400;

    return callback(error, false);
  }

  callback(null, true);
};

const uploadProductImage = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

module.exports = uploadProductImage;
