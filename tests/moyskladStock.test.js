const assert = require("node:assert/strict");
const test = require("node:test");

const { calculateRetailStock } = require("../src/utils/moyskladStock");

test("negative and unnumbered warehouse stock does not reduce retail stock", () => {
  const stock = calculateRetailStock([
    { storeName: "1 Toshkent - Qatortol - bosh do'kon", available: 2 },
    { storeName: "7 Namangan filial", available: -2 },
    { storeName: "Qarshi filial", available: 3 },
    { storeName: "0 Book.uz sklad", available: 10 },
  ]);

  assert.equal(stock, 2);
});
