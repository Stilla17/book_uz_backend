const cron = require("node-cron");
const { sendBirthdaySms } = require("../services/birthdaySmsService");

function startBirthdaySmsCron() {
  // Har kuni Toshkent vaqti bilan 09:00
  cron.schedule(
    "0 9 * * *",
    async () => {
      try {
        await sendBirthdaySms();
      } catch (error) {
        console.error("Tug'ilgan kun SMS cron xatosi:", error.message);
      }
    },
    {
      timezone: "Asia/Tashkent",
    },
  );

  console.log("Tug'ilgan kun SMS cron ishga tushdi");
}

module.exports = { startBirthdaySmsCron };
