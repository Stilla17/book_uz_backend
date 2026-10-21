const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});

const dns = require("dns");
const mongoose = require("mongoose");
const {
  ensureUserEmailIndex,
} = require("../src/utils/ensureUserEmailIndex");

dns.setServers(["1.1.1.1", "1.0.0.1"]);
dns.setDefaultResultOrder("ipv4first");

const migrateUserEmailIndex = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI .env faylidan topilmadi");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  await ensureUserEmailIndex();
};

migrateUserEmailIndex()
  .catch((error) => {
    console.error("User email indeks migratsiyasi xatosi:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
