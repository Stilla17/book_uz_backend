const AmoContact = require("../models/AmoContact");
const { getAllContacts } = require("./amocrmService");
const { formatUzPhone, normalizePhone } = require("../utils/phone");
const { isValidPhone } = require("../utils/validator");

const normalizeEmail = (email) => email?.toString().trim().toLowerCase() || "";

function getFieldValues(contact, fieldCode) {
  const field = contact.custom_fields_values?.find(
    (item) => item.field_code === fieldCode,
  );

  return field?.values?.map((item) => item.value).filter(Boolean) || [];
}

async function syncAmoContacts() {
  const contacts = await getAllContacts();
  const savedContacts = await AmoContact.find(
    {},
    "_id amoId normalizedPhones normalizedEmails phones emails",
  ).lean();

  const byAmoId = new Map();
  const byPhone = new Map();
  const byEmail = new Map();

  for (const contact of savedContacts) {
    if (contact.amoId) {
      byAmoId.set(contact.amoId, contact._id);
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

  const operations = contacts.flatMap((contact) => {
    const phones = getFieldValues(contact, "PHONE")
      .map(formatUzPhone)
      .filter(isValidPhone);
    const emails = getFieldValues(contact, "EMAIL");
    const normalizedPhones = phones.map(normalizePhone).filter(Boolean);
    const normalizedEmails = emails.map(normalizeEmail).filter(Boolean);

    if (phones.length === 0) return [];

    const existingId =
      byAmoId.get(contact.id) ||
      normalizedPhones.map((phone) => byPhone.get(phone)).find(Boolean) ||
      normalizedEmails.map((email) => byEmail.get(email)).find(Boolean);
    const filter = existingId ? { _id: existingId } : { amoId: contact.id };

    return {
      updateOne: {
        filter,
        update: {
          $set: {
            amoId: contact.id,
            name: contact.name,
            firstName: contact.first_name,
            lastName: contact.last_name,
            responsibleUserId: contact.responsible_user_id,
            "sources.amocrm": true,
            tags: contact._embedded?.tags || [],
            customFields: contact.custom_fields_values || [],
            amoCreatedAt: contact.created_at
              ? new Date(contact.created_at * 1000)
              : null,
            amoUpdatedAt: contact.updated_at
              ? new Date(contact.updated_at * 1000)
              : null,
            syncedAt: new Date(),
          },
          $addToSet: {
            phones: { $each: phones },
            normalizedPhones: { $each: normalizedPhones },
            emails: { $each: emails },
            normalizedEmails: { $each: normalizedEmails },
          },
        },
        upsert: true,
      },
    };
  });

  if (operations.length > 0) {
    await AmoContact.bulkWrite(operations);
  }

  return {
    received: contacts.length,
    synchronized: operations.length,
  };
}

module.exports = {
  syncAmoContacts,
};
