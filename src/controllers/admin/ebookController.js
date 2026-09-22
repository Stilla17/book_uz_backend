const { randomUUID } = require("crypto");
const Product = require("../../models/Product");
const apiResponse = require("../../utils/apiResponse");
const cloudinary = require("../../config/cloudinary");

const isEpub = (buffer) => {
  if (!buffer || buffer.length < 58) return false;

  return (
    buffer.readUInt32LE(0) === 0x04034b50 &&
    buffer.readUInt16LE(8) === 0 &&
    buffer.readUInt32LE(18) === 20 &&
    buffer.readUInt16LE(26) === 8 &&
    buffer.readUInt16LE(28) === 0 &&
    buffer.subarray(30, 38).toString("ascii") === "mimetype" &&
    buffer.subarray(38, 58).toString("ascii") === "application/epub+zip"
  );
};

const uploadEpubToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
        folder: "bookstore/ebooks",
        public_id: `${randomUUID()}-${Date.now()}`,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    stream.end(buffer);
  });

exports.deleteEbook = async (req, res, next) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) {
      return apiResponse(res, 400, false, "Kitob ID noto'g'ri");
    }

    const product = await Product.findById(req.params.id).select("ebook");
    if (!product?.ebook?.storageKey) {
      return apiResponse(res, 404, false, "Elektron kitob topilmadi");
    }

    const key = product.ebook.storageKey;
    const result = await Product.updateOne(
      { _id: product._id, "ebook.storageKey": key },
      { $unset: { ebook: "" } },
    );

    if (result.modifiedCount !== 1) {
      return apiResponse(
        res,
        409,
        false,
        "Kitob o'zgargan, qayta urinib ko'ring",
      );
    }

    try {
      await cloudinary.uploader.destroy(key, { resource_type: "raw" });
    } catch (error) {
      console.error("Cloudinary epub o'chirishda xato:", error);
    }

    return apiResponse(res, 200, true, "Elektron fayl o'chirildi");
  } catch (error) {
    next(error);
  }
};

const saveEbook = (replaceExisting) => async (req, res, next) => {
  try {
    if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
      return apiResponse(res, 400, false, "Kitob ID noto‘g‘ri");
    }

    if (!req.file) {
      return apiResponse(res, 400, false, "epub fayl yuboring");
    }

    if (!isEpub(req.file.buffer)) {
      return apiResponse(res, 400, false, "Fayl epub formatida emas");
    }

    const product = await Product.findById(req.params.id).select("price ebook");

    if (!product) {
      return apiResponse(res, 404, false, "Kitob topilmadi");
    }

    const ebookPrice = Math.round(Number(product.price) * 0.5);
    if (!Number.isFinite(ebookPrice) || ebookPrice <= 0) {
      return apiResponse(res, 400, false, "Kitob narxi noto'g'ri");
    }

    const oldKey = product.ebook?.storageKey;
    if (oldKey && !replaceExisting) {
      return apiResponse(
        res,
        409,
        false,
        "Bu kitobga epub allaqachon qo‘shilgan",
      );
    }

    if (!oldKey && replaceExisting) {
      return apiResponse(
        res,
        404,
        false,
        "Almashtiriladigan elektron kitob topilmadi",
      );
    }

    const uploaded = await uploadEpubToCloudinary(req.file.buffer);

    const ebook = {
      storageKey: uploaded.public_id,
      originalName: req.file.originalname,
      format: "epub",
      size: req.file.size,
      access: "purchase",
      price: ebookPrice,
      url: uploaded.secure_url,
    };

    const updatedProduct = await Product.findOneAndUpdate(
      oldKey
        ? { _id: product._id, "ebook.storageKey": oldKey }
        : {
            _id: product._id,
            $or: [
              { "ebook.storageKey": { $exists: false } },
              { "ebook.storageKey": null },
              { "ebook.storageKey": "" },
            ],
          },
      { $set: { ebook } },
      { new: true, runValidators: true },
    ).select("_id");

    if (!updatedProduct) {
      try {
        await cloudinary.uploader.destroy(uploaded.public_id, {
          resource_type: "raw",
        });
      } catch (err) {
        console.error("rollback error:", err);
      }

      return apiResponse(
        res,
        409,
        false,
        "Kitob o‘zgargan yoki unga epub qo‘shilgan",
      );
    }

    if (oldKey) {
      try {
        await cloudinary.uploader.destroy(oldKey, { resource_type: "raw" });
      } catch (err) {
        console.error("old file cleanup error:", err);
      }
    }

    return apiResponse(
      res,
      oldKey ? 200 : 201,
      true,
      oldKey ? "Elektron kitob almashtirildi" : "Elektron kitob qo‘shildi",
      {
        productId: updatedProduct._id,
        ebook: {
          originalName: ebook.originalName,
          format: ebook.format,
          size: ebook.size,
          access: ebook.access,
          price: ebook.price,
          url: ebook.url,
        },
      },
    );
  } catch (error) {
    next(error);
  }
};

exports.uploadEbook = saveEbook(false);
exports.replaceEbook = saveEbook(true);
