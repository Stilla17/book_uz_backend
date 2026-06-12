const { syncAmoContacts } = require("../services/amoContactSyncService");
const {
  syncMoyskladCustomers,
} = require("../services/moyskladCustomerSyncService");

const TEN_HOURS_IN_MS = 10 * 60 * 60 * 1000;

let isSyncing = false;

async function runAmoContactSync() {
  if (isSyncing) {
    console.log("amoCRM kontakt sinxronizatsiyasi hali davom etmoqda");
    return;
  }

  isSyncing = true;

  try {
    const amoResult = await syncAmoContacts();
    console.log(
      `amoCRM kontaktlari sinxronlandi: ${amoResult.synchronized}/${amoResult.received}`,
    );

    const moyskladResult = await syncMoyskladCustomers();
    console.log(
      `MoySklad xaridorlari sinxronlandi: ${moyskladResult.synchronized}/${moyskladResult.received}`,
    );
  } catch (error) {
    console.error(
      "Mijozlar sinxronizatsiyasi xatosi:",
      error.response?.data || error.message,
    );
  } finally {
    isSyncing = false;
  }
}

function startAmoContactSync() {
  runAmoContactSync();

  setInterval(runAmoContactSync, TEN_HOURS_IN_MS);

  console.log(
    "amoCRM va MoySklad mijozlar sinxronizatsiyasi har 10 soatga sozlandi",
  );
}

module.exports = {
  runAmoContactSync,
  startAmoContactSync,
};
