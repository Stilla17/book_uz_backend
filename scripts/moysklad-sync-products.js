const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const connectDB = require("../src/config/db");
const { syncMoyskladProducts } = require("../src/utils/moyskladSync");

const run = async () => {
  try {
    await connectDB();
    await syncMoyskladProducts();
  } catch (error) {
    console.error("MoySklad mahsulot sync ishga tushmadi:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
