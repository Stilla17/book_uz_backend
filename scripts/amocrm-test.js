require("dotenv").config();
const dns = require("dns");
const mongoose = require("mongoose");

dns.setServers(["1.1.1.1", "1.0.0.1"]);
dns.setDefaultResultOrder("ipv4first");

const connectDB = require("../src/config/db");
const { amoRequest } = require("../src/services/amocrmService");

async function testConnection() {
  try {
    await connectDB();

    const data = await amoRequest({
      method: "GET",
      url: "/api/v4/account",
    });

    console.log("amoCRM ulandi:", data.name);
  } catch (error) {
    console.error(error.response?.data || error.message);
  } finally {
    await mongoose.disconnect();
  }
}
testConnection();
