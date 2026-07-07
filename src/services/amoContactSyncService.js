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

  const operations = contacts.flatMap((contact) => {
    const phones = getFieldValues(contact, "PHONE")
      .map(formatUzPhone)
      .filter(isValidPhone);
    const emails = getFieldValues(contact, "EMAIL");

    if (phones.length === 0) return [];

    return {
      updateOne: {
        filter: {
          amoId: contact.id,
        },
        update: {
          $set: {
            name: contact.name,
            firstName: contact.first_name,
            lastName: contact.last_name,
            responsibleUserId: contact.responsible_user_id,
            phones,
            normalizedPhones: phones.map(normalizePhone).filter(Boolean),
            emails,
            normalizedEmails: emails.map(normalizeEmail).filter(Boolean),
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
