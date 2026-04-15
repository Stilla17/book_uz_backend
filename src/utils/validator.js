const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const isValidPhone = (phone) => {
  const re = /^\+998\d{9}$/;
  return re.test(phone);
};

module.exports = { isValidEmail, isValidPhone };