const multer = require("multer");
const path = require("path");

const uploadEbook = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname || "") || "").toLowerCase();
    const mime = (file.mimetype || "").toLowerCase();

    const isEpubByExtension = ext === ".epub";
    const isEpubByMime = mime.includes("epub");

    if (!isEpubByExtension && !isEpubByMime) {
      return cb(new Error("Faqat epub fayl yuklash mumkin"));
    }

    cb(null, true);
  },
});

module.exports = uploadEbook;