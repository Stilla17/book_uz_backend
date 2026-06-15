const AmoContact = require("../models/AmoContact");
const sendEskizSms = require("../utils/sendEskizSms");

const MESSAGE =
  "Tugilgan kuningiz muborak! Book.uz sizga bugun 10% chegirma taqdim etadi. Sizni kutamiz.";

async function sendBirthdaySms() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();

  const contacts = await AmoContact.find({
    birthDate: { $ne: null },
    phones: { $exists: true, $ne: [] },
    birthdaySmsSentYear: { $ne: year },
    $expr: {
      $and: [
        { $eq: [{ $month: "$birthDate" }, month] },
        { $eq: [{ $dayOfMonth: "$birthDate" }, day] },
      ],
    },
  });

  let sent = 0;
  let failed = 0;

  for (const contact of contacts) {
    const reserved = await AmoContact.findOneAndUpdate(
      {
        _id: contact._id,
        birthdaySmsSentYear: { $ne: year },
      },
      {
        $set: { birthdaySmsSentYear: year },
      },
      { new: true },
    );

    if (!reserved) continue;
    try {
      await sendEskizSms(contact.phones[0], MESSAGE);
      sent += 1;
    } catch (error) {
      failed += 1;

      await AmoContact.updateOne(
        {
          _id: contact._id,
          birthdaySmsSentYear: year,
        },
        {
          $unset: { birthdaySmsSentYear: 1 },
        },
      );

      console.error(
        `Tug'ilgan kun SMS yuborilmadi: ${contact.phones[0]}`,
        error.message,
      );
    }
  }

  console.log(`Tug'ilgan kun SMS: ${sent} yuborildi, ${failed} xato`);
}

module.exports = { sendBirthdaySms };
