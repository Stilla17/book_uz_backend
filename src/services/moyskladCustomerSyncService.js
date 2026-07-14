const axios = require("axios");
const AmoContact = require("../models/AmoContact");
const { formatUzPhone, normalizePhone } = require("../utils/phone");
const { isValidPhone } = require("../utils/validator");

const DEFAULT_BASE_URL = "https://api.moysklad.ru/api/remap/1.2";
const PAGE_SIZE = 1000;

const normalizeEmail = (email) => email?.toString().trim().toLowerCase() || "";

function getBaseUrl() {
  const configuredUrl = process.env.MOYSKLAD_API_URL;

  if (!configuredUrl) return DEFAULT_BASE_URL;

  const marker = "/api/remap/1.2";
  const markerIndex = configuredUrl.indexOf(marker);

  if (markerIndex === -1) {
    return configuredUrl.replace(/\/entity\/.*$/, "");
  }

  return configuredUrl.slice(0, markerIndex + marker.length);
}

function isCustomer(counterparty) {
  return (counterparty.tags || []).some(
    (tag) => tag?.toString().trim().toLowerCase() === "покупатель",
  );
}

function getBirthDate(counterparty) {
  if (counterparty.birthDate) {
    return new Date(counterparty.birthDate);
  }

  const field = (counterparty.attributes || []).find((attribute) => {
    const name = attribute.name?.toLowerCase() || "";
    return name.includes("дата рождения") || name.includes("tug'ilgan");
  });

  return field?.value ? new Date(field.value) : null;
}

function hasSyncablePhone(customer) {
  return Boolean(customer.phone) && isValidPhone(formatUzPhone(customer.phone));
}

async function getAllMoyskladCustomers() {
  const customers = [];
  let offset = 0;

  while (true) {
    const { data } = await axios.get(
      `${getBaseUrl()}/entity/counterparty`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MOYSKLAD_API_KEY}`,
          "Cache-Control": "no-cache",
        },
        params: {
          limit: PAGE_SIZE,
          offset,
        },
        timeout: 30000,
      },
    );

    const rows = data.rows || [];
    customers.push(...rows.filter(isCustomer));

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return customers;
}

async function getCounterpartyStats() {
  const statsByCounterpartyId = new Map();
  let offset = 0;

  while (true) {
    const { data } = await axios.get(
      `${getBaseUrl()}/report/counterparty`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MOYSKLAD_API_KEY}`,
          "Cache-Control": "no-cache",
        },
        params: {
          limit: PAGE_SIZE,
          offset,
        },
        timeout: 30000,
      },
    );

    const rows = data.rows || [];

    for (const row of rows) {
      const counterpartyId = row.counterparty?.meta?.href?.split("/").pop();

      if (counterpartyId) {
        statsByCounterpartyId.set(counterpartyId, row);
      }
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return statsByCounterpartyId;
}

async function getCustomerOrderStats() {
  const statsByCounterpartyId = new Map();
  let offset = 0;

  while (true) {
    const { data } = await axios.get(
      `${getBaseUrl()}/entity/customerorder`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MOYSKLAD_API_KEY}`,
          "Cache-Control": "no-cache",
        },
        params: {
          limit: PAGE_SIZE,
          offset,
        },
        timeout: 30000,
      },
    );

    const rows = data.rows || [];

    for (const order of rows) {
      const counterpartyId = order.agent?.meta?.href?.split("/").pop();

      if (!counterpartyId) continue;

      const current = statsByCounterpartyId.get(counterpartyId) || {
        ordersCount: 0,
        ordersAmount: 0,
        lastOrderAt: null,
      };
      const orderDate = order.moment ? new Date(order.moment) : null;

      current.ordersCount += 1;
      current.ordersAmount += Number(order.sum) || 0;

      if (
        orderDate &&
        !Number.isNaN(orderDate.getTime()) &&
        (!current.lastOrderAt || orderDate > current.lastOrderAt)
      ) {
        current.lastOrderAt = orderDate;
      }

      statsByCounterpartyId.set(counterpartyId, current);
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return statsByCounterpartyId;
}

async function syncMoyskladCustomers() {
  const [customers, statsByCounterpartyId, ordersByCounterpartyId] = await Promise.all([
    getAllMoyskladCustomers(),
    getCounterpartyStats(),
    getCustomerOrderStats(),
  ]);
  const customersWithPhone = customers.filter(hasSyncablePhone);
  const contacts = await AmoContact.find(
    {},
    "_id moyskladId normalizedPhones normalizedEmails phones emails",
  ).lean();

  const byMoyskladId = new Map();
  const byPhone = new Map();
  const byEmail = new Map();

  for (const contact of contacts) {
    if (contact.moyskladId) {
      byMoyskladId.set(contact.moyskladId, contact._id);
    }

    const phones = contact.normalizedPhones?.length
      ? contact.normalizedPhones
      : (contact.phones || []).map(normalizePhone);
    const emails = contact.normalizedEmails?.length
      ? contact.normalizedEmails
      : (contact.emails || []).map(normalizeEmail);

    phones.filter(Boolean).forEach((phone) => byPhone.set(phone, contact._id));
    emails.filter(Boolean).forEach((email) => byEmail.set(email, contact._id));
  }

  const operations = customersWithPhone.flatMap((customer) => {
    const formattedPhone = formatUzPhone(customer.phone);
    const phone = normalizePhone(formattedPhone);
    const email = normalizeEmail(customer.email);
    const stats = statsByCounterpartyId.get(customer.id);
    const orderStats = ordersByCounterpartyId.get(customer.id);

    const existingId =
      byMoyskladId.get(customer.id) ||
      (phone ? byPhone.get(phone) : null) ||
      (email ? byEmail.get(email) : null);
    const filter = existingId ? { _id: existingId } : { moyskladId: customer.id };
    const update = {
      $set: {
        moyskladId: customer.id,
        moyskladTags: customer.tags || [],
        lastSaleAt: stats?.lastDemandDate
          ? new Date(stats.lastDemandDate)
          : null,
        lastOrderAt: orderStats?.lastOrderAt || null,
        ordersCount: orderStats?.ordersCount || 0,
        ordersAmount: (orderStats?.ordersAmount || 0) / 100,
        salesCount: stats?.demandsCount || 0,
        averageCheck: (stats?.averageReceipt || 0) / 100,
        salesAmount: (stats?.demandsSum || customer.salesAmount || 0) / 100,
        ...(getBirthDate(customer)
          ? { birthDate: getBirthDate(customer) }
          : {}),
        "sources.moysklad": true,
        moyskladCreatedAt: customer.created
          ? new Date(customer.created)
          : null,
        moyskladUpdatedAt: customer.updated
          ? new Date(customer.updated)
          : null,
        moyskladData: {
          companyType: customer.companyType,
          externalCode: customer.externalCode,
          notes: customer.notes,
          salesAmount: customer.salesAmount,
          tags: customer.tags || [],
          attributes: customer.attributes || [],
        },
        syncedAt: new Date(),
      },
      $setOnInsert: {
        name: customer.name,
      },
    };

    if (phone) {
      update.$addToSet = {
        ...update.$addToSet,
        phones: formattedPhone,
        normalizedPhones: phone,
      };
    }

    if (email) {
      update.$addToSet = {
        ...update.$addToSet,
        emails: customer.email,
        normalizedEmails: email,
      };
    }

    return {
      updateOne: {
        filter,
        update,
        upsert: true,
      },
    };
  });

  if (operations.length > 0) {
    await AmoContact.bulkWrite(operations);
  }

  return {
    received: customers.length,
    synchronized: operations.length,
    skippedWithoutPhone: customers.length - customersWithPhone.length,
  };
}

module.exports = {
  getAllMoyskladCustomers,
  getCounterpartyStats,
  getCustomerOrderStats,
  syncMoyskladCustomers,
};
