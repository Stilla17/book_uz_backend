const AmoContact = require("../models/AmoContact");
const User = require("../models/User");
const sendEskizSms = require("../utils/sendEskizSms");
const { normalizePhone } = require("../utils/phone");

const MESSAGE =
  "Tug\u2018ilgan kuningiz muborak bo\u2018lsin! BOOK.UZ bugungi kun uchun faqat sizga 10% chegirma sovg\u2018a qildi. Imkoniyatdan kun davomida onlayn yoki oflayn foydalanishingiz mumkin. www.book.uz +998712300050";
const TIMEZONE = "Asia/Tashkent";

function getTashkentToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function birthdayMatchesTodayExpr(month, day) {
  return {
    $eq: [
      {
        $dateToString: {
          format: "%m-%d",
          date: "$birthDate",
          timezone: TIMEZONE,
        },
      },
      `${month}-${day}`,
    ],
  };
}

async function sendBirthdaySmsForModel({
  model,
  modelName,
  phoneSelector,
  phoneFilter,
  month,
  day,
  year,
  processedPhones,
}) {
  const recipients = await model.find({
    birthDate: { $ne: null },
    ...phoneFilter,
    birthdaySmsSentYear: { $ne: year },
    $expr: birthdayMatchesTodayExpr(month, day),
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const recipient of recipients) {
    const phone = phoneSelector(recipient);
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      skipped += 1;
      continue;
    }

    if (processedPhones.has(normalizedPhone)) {
      await model.updateOne(
        {
          _id: recipient._id,
          birthdaySmsSentYear: { $ne: year },
        },
        {
          $set: { birthdaySmsSentYear: year },
        },
      );
      skipped += 1;
      continue;
    }

    const reserved = await model.findOneAndUpdate(
      {
        _id: recipient._id,
        birthdaySmsSentYear: { $ne: year },
      },
      {
        $set: { birthdaySmsSentYear: year },
      },
      { new: true },
    );

    if (!reserved) continue;

    try {
      await sendEskizSms(phone, MESSAGE);
      processedPhones.add(normalizedPhone);
      sent += 1;
    } catch (error) {
      failed += 1;

      await model.updateOne(
        {
          _id: recipient._id,
          birthdaySmsSentYear: year,
        },
        {
          $unset: { birthdaySmsSentYear: 1 },
        },
      );

      console.error(
        `Tug'ilgan kun SMS yuborilmadi (${modelName}): ${phone}`,
        error.message,
      );
    }
  }

  return { sent, failed, skipped };
}

async function sendBirthdaySms() {
  const { year, month, day } = getTashkentToday();
  const processedPhones = new Set();

  const amoResult = await sendBirthdaySmsForModel({
    model: AmoContact,
    modelName: "AmoContact",
    phoneSelector: (contact) => contact.phones?.[0],
    phoneFilter: { phones: { $exists: true, $ne: [] } },
    month,
    day,
    year: Number(year),
    processedPhones,
  });

  const userResult = await sendBirthdaySmsForModel({
    model: User,
    modelName: "User",
    phoneSelector: (user) => user.phone,
    phoneFilter: { phone: { $exists: true, $nin: [null, ""] } },
    month,
    day,
    year: Number(year),
    processedPhones,
  });

  const sent = amoResult.sent + userResult.sent;
  const failed = amoResult.failed + userResult.failed;
  const skipped = amoResult.skipped + userResult.skipped;

  console.log(
    `Tug'ilgan kun SMS: ${sent} yuborildi, ${failed} xato, ${skipped} takror/raqamsiz o'tkazildi`,
  );
}

module.exports = { sendBirthdaySms };
