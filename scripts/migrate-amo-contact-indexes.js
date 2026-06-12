require("dotenv").config();

const dns = require("dns");
const mongoose = require("mongoose");

dns.setServers(["1.1.1.1", "1.0.0.1"]);
dns.setDefaultResultOrder("ipv4first");

const connectDB = require("../src/config/db");
const AmoContact = require("../src/models/AmoContact");

async function migrateIndexes() {
  try {
    await connectDB();

    const indexes = await AmoContact.collection.indexes();
    const amoIdIndex = indexes.find((index) => index.name === "amoId_1");

    if (amoIdIndex && !amoIdIndex.sparse) {
      await AmoContact.collection.dropIndex("amoId_1");
    }

    await AmoContact.collection.createIndex(
      { amoId: 1 },
      { unique: true, sparse: true, name: "amoId_1" },
    );
    await AmoContact.collection.createIndex(
      { moyskladId: 1 },
      { unique: true, sparse: true, name: "moyskladId_1" },
    );

    console.log("AmoContact indekslari yangilandi");
  } catch (error) {
    console.error("Indeks migratsiyasi xatosi:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

migrateIndexes();
