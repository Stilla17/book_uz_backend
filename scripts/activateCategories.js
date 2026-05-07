require("dotenv").config();

const dns = require("dns");
const mongoose = require("mongoose");
const Category = require("../src/models/Category");

dns.setServers(["1.1.1.1", "1.0.0.1"]);
dns.setDefaultResultOrder("ipv4first");

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const categoriesResult = await Category.updateMany(
    {},
    { $set: { isActive: true } },
  );

  const subgenresResult = await Category.updateMany(
    { "subgenres.0": { $exists: true } },
    { $set: { "subgenres.$[].isActive": true } },
  );

  console.log(
    JSON.stringify(
      {
        categories: {
          matched: categoriesResult.matchedCount,
          modified: categoriesResult.modifiedCount,
        },
        subgenres: {
          matched: subgenresResult.matchedCount,
          modified: subgenresResult.modifiedCount,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
