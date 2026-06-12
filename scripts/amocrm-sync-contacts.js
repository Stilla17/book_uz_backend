require("dotenv").config();

const dns = require("dns");
const mongoose = require("mongoose");

dns.setServers(["1.1.1.1", "1.0.0.1"]);
dns.setDefaultResultOrder("ipv4first");

const connectDB = require("../src/config/db");
const { syncAmoContacts } = require("../src/services/amoContactSyncService");

async function run() {
  try {
    await connectDB();

    const result = await syncAmoContacts();

    console.log("Sinxronizatsiya tugadi:", result);
  } catch (error) {
    console.error(
      "Sinxronizatsiya xatosi:",
      error.response?.data || error.message,
    );
  } finally {
    await mongoose.disconnect();
  }
}

run();
