require("dotenv").config();

const dns = require("dns");
const mongoose = require("mongoose");

dns.setServers(["1.1.1.1", "1.0.0.1"]);
dns.setDefaultResultOrder("ipv4first");

const connectDB = require("../src/config/db");
const {
  syncMoyskladCustomers,
} = require("../src/services/moyskladCustomerSyncService");

async function run() {
  try {
    await connectDB();
    const result = await syncMoyskladCustomers();
    console.log("MoySklad xaridorlari sinxronlandi:", result);
  } catch (error) {
    console.error(
      "MoySklad xaridor sync xatosi:",
      error.response?.data || error.message,
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
