const getPhoneDigits = (phone) =>
  phone?.toString().trim().replace(/\D/g, "") || "";

const formatUzPhone = (phone) => {
  const digits = getPhoneDigits(phone);

  if (!digits) return "";

  if (digits.startsWith("998")) {
    return `+${digits}`;
  }

  return `+998${digits.replace(/^0+/, "")}`;
};

const normalizePhone = (phone) => getPhoneDigits(formatUzPhone(phone));

module.exports = {
  formatUzPhone,
  normalizePhone,
};
