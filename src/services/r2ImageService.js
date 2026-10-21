const crypto = require("crypto");
const sharp = require("sharp");
const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } = require("../config/r2");

const optimizeCatalogImage = async (fileBuffer) => {
  return sharp(fileBuffer, {
    limitInputPixels: 20_000_000,
  })
    .rotate()
    .resize({
      width: 800,
      height: 1200,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: 78,
      effort: 4,
    })
    .toBuffer();
};

const createCatalogImageKey = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const fileName = `${crypto.randomUUID()}.webp`;

  return `catalog/${year}/${month}/${fileName}`;
};

const uploadCatalogImageToR2 = async (fileBuffer) => {
  const optimizedBuffer = await optimizeCatalogImage(fileBuffer);
  const key = createCatalogImageKey();

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: optimizedBuffer,
      ContentType: "image/webp",
      ContentDisposition: "inline",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    key,
    url: `${R2_PUBLIC_URL}/${key}`,
    size: optimizedBuffer.length,
  };
};

const deleteCatalogImageFromR2 = async (key) => {
  if (!key) {
    return false;
  }

  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
  );

  return true;
};

module.exports = {
  uploadCatalogImageToR2,
  deleteCatalogImageFromR2,
};
