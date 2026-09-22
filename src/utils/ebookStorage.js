const path = require("node:path");

const EBOOK_DIR = path.resolve(__dirname, "../../private/ebooks");

const getEbookPath = (key) => {
  if (typeof key !== "string" || !/^[a-f0-9-]{36}\.(?:epub|pdf)$/i.test(key)) {
    const error = new Error("epub fayl identifikatori noto'g'ri");
    error.statusCode = 404;
    throw error;
  }
  return path.join(EBOOK_DIR, key);
};

module.exports = { EBOOK_DIR, getEbookPath };
