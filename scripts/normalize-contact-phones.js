require("dotenv").config();

const dns = require("dns");
const mongoose = require("mongoose");

dns.setServers(["1.1.1.1", "1.0.0.1"]);
dns.setDefaultResultOrder("ipv4first");

const connectDB = require("../src/config/db");
const AmoContact = require("../src/models/AmoContact");
const { formatUzPhone, normalizePhone } = require("../src/utils/phone");

async function normalizeContactPhones() {
  try {
    await connectDB();

    const contacts = await AmoContact.find({}, "_id phones").lean();
    const operations = contacts.map((contact) => {
      const phones = [
        ...new Set((contact.phones || []).map(formatUzPhone).filter(Boolean)),
      ];

      return {
        updateOne: {
          filter: { _id: contact._id },
          update: {
            $set: {
              phones,
              normalizedPhones: phones.map(normalizePhone),
            },
          },
        },
      };
    });

    if (operations.length > 0) {
      await AmoContact.bulkWrite(operations);
    }

    console.log(`${operations.length} ta kontakt telefoni formatlandi`);
  } catch (error) {
    console.error("Telefon formatlash xatosi:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

normalizeContactPhones();
