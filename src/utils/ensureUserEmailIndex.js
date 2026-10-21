const mongoose = require("mongoose");

const EMAIL_INDEX_NAME = "email_1";
const EMAIL_INDEX_OPTIONS = {
  name: EMAIL_INDEX_NAME,
  unique: true,
  partialFilterExpression: { email: { $type: "string" } },
};

const isCorrectEmailIndex = (index) =>
  index?.unique === true &&
  index?.partialFilterExpression?.email?.$type === "string";

const ensureUserEmailIndex = async () => {
  const users = mongoose.connection.collection("users");
  let indexes = [];

  try {
    indexes = await users.indexes();
  } catch (error) {
    // Yangi bazada users kolleksiyasi hali mavjud bo'lmasligi mumkin.
    if (error?.code !== 26 && error?.codeName !== "NamespaceNotFound") {
      throw error;
    }
  }

  const currentIndex = indexes.find(
    (index) => index.name === EMAIL_INDEX_NAME,
  );

  if (isCorrectEmailIndex(currentIndex)) {
    console.log("users.email indeksi tekshirildi");
    return;
  }

  if (currentIndex) {
    try {
      await users.dropIndex(EMAIL_INDEX_NAME);
      console.log("Eski users.email indeksi o'chirildi");
    } catch (error) {
      // Boshqa PM2 instance indeksni birinchi bo'lib o'chirgan bo'lishi mumkin.
      if (error?.code !== 27 && error?.codeName !== "IndexNotFound") {
        throw error;
      }
    }
  }

  try {
    await users.createIndex({ email: 1 }, EMAIL_INDEX_OPTIONS);
  } catch (error) {
    // Parallel instance ayni indeksni yaratgan bo'lsa, natijani qayta tekshiramiz.
    const latestIndexes = await users.indexes();
    const latestEmailIndex = latestIndexes.find(
      (index) => index.name === EMAIL_INDEX_NAME,
    );

    if (!isCorrectEmailIndex(latestEmailIndex)) {
      throw error;
    }
  }

  console.log("Yangi partial unique users.email indeksi yaratildi");
};

module.exports = { ensureUserEmailIndex };
