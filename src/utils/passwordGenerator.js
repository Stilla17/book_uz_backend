const crypto = require('crypto');

const generateTempPassword = (length = 10) => {
  // O'qishga qulay belgilar to'plami (Chalkash harflar olib tashlandi)
  const charset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&";
  let password = "";
  
  const randomValues = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(randomValues[i] % charset.length);
  }
  
  return password;
};

module.exports = generateTempPassword;