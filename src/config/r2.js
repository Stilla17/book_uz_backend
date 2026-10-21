require("dotenv").config();
const { S3Client } = require("@aws-sdk/client-s3");

const requiredEnv = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`${key} environment variable kiritilmagan`);
  }
}

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL.replace(/\/+$/, "");

module.exports = {
  r2Client,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
};
