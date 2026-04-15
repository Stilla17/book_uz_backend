const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

/**
 * Dinamik storage funksiyasi
 * Bu orqali bitta middleware bilan ham product, ham avatar, ham audio yuklasa bo'ladi
 */

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folderName = 'bookstore/others';
    let resourceType = 'image';
    let allowedFormats = ['jpg', 'png', 'jpeg', 'webp', 'gif'];
    let transformation = [
      { width: 1000, height: 1000, crop: 'limit' },
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ];


    if (file.mimetype.startsWith('image/')) {
      folderName = 'bookstore/images';
      resourceType = 'image';
      allowedFormats = ['jpg', 'png', 'jpeg', 'webp', 'gif', 'svg'];
      

      if (req.baseUrl?.includes('product') || req.path?.includes('product')) {
        folderName = 'bookstore/products';
      } else if (req.baseUrl?.includes('user') || req.path?.includes('profile') || req.path?.includes('avatar')) {
        folderName = 'bookstore/avatars';
      } else if (req.baseUrl?.includes('category') || req.path?.includes('category')) {
        folderName = 'bookstore/categories';
      } else if (req.baseUrl?.includes('banner') || req.path?.includes('banner')) {
        folderName = 'bookstore/banners';
      }
    }
    
    // Audio fayl uchun
    else if (file.mimetype.startsWith('audio/')) {
      resourceType = 'video'; 
      folderName = 'bookstore/audio';
      allowedFormats = ['mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac', 'mpeg'];
      transformation = []; 
      
      // Audio kitoblar uchun maxsus papka
      if (req.baseUrl?.includes('audio') || req.path?.includes('audio')) {
        folderName = 'bookstore/audio/books';
      }
    }


    return {
      folder: folderName,
      resource_type: resourceType,
      allowed_formats: allowedFormats,
      transformation: transformation,
      public_id: `${Date.now()}-${file.originalname.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_')}`
    };
  },
});

/**
 * Fayl filtratsiyasi (Rasm va audio fayllarni tekshirish)
 */

const fileFilter = (req, file, cb) => {
  console.log(' File filter check:', file.mimetype, file.originalname);
  
  // Rasm fayllarga ruxsat
  if (file.mimetype.startsWith('image/')) {
    console.log('Rasm fayl qabul qilindi');
    cb(null, true);
  } 
  // Audio fayllarga ruxsat
  else if (file.mimetype.startsWith('audio/')) {
    console.log('Audio fayl qabul qilindi');
    cb(null, true);
  } 
  // Video fayllarga ruxsat
  else if (file.mimetype.startsWith('video/')) {
    console.log('Video fayl qabul qilindi');
    cb(null, true);
  } 
  else {
    console.log('Noto\'g\'ri fayl turi:', file.mimetype);
    cb(new Error("Faqat rasm, audio va video fayllar yuklash mumkin! (jpg, png, mp3, mp4)"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // Maksimal 100MB
  }
});

module.exports = upload;