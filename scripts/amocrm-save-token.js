require("dotenv").config();

const dns = require("dns");
const mongoose = require("mongoose");
dns.setServers(["1.1.1.1", "1.0.0.1"]);
dns.setDefaultResultOrder("ipv4first");

const connectDB = require("../src/config/db");
const AmoToken = require("../src/models/AmoToken");

async function saveTokens() {
  try {
    await connectDB();

    const payload = JSON.parse(
      Buffer.from(
        process.env.AMOCRM_ACCESS_TOKEN.split(".")[1],
        "base64url",
      ).toString(),
    );

    await AmoToken.findOneAndUpdate(
      {},
      {
        accessToken: process.env.AMOCRM_ACCESS_TOKEN,
        refreshToken: process.env.AMOCRM_REFRESH_TOKEN,
        expiresAt: new Date(payload.exp * 1000),
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );
    console.log("amoCRM tokenlari MongoDB'ga saqlandi");
  } catch (error) {
    console.error("Saqlashda xato:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

saveTokens();
