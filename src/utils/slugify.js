const slugify = (text) => {
  if (!text) return '';
  
  const uzbekChars = {
    'o‘': 'o', 'o\'': 'o', 'g‘': 'g', 'g\'': 'g', 'sh': 'sh', 'ch': 'ch', 'ñ': 'n'
  };

  let string = text.toString().toLowerCase().trim();

  Object.keys(uzbekChars).forEach(key => {
    string = string.replace(new RegExp(key, 'g'), uzbekChars[key]);
  });

  return string
    .replace(/\s+/g, '-')           // Bo'shliqlarni chiziqcha qiladi
    .replace(/[^\w-]+/g, '')        // Kirill yoki boshqa belgilarni o'chiradi
    .replace(/--+/g, '-')           // Dublikat chiziqlarni o'chiradi
    .replace(/^-+/, '')             // Boshidagi chiziqni o'chiradi
    .replace(/-+$/, '');            // Oxiridagi chiziqni o'chiradi
};

module.exports = slugify;