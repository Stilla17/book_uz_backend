const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculatePriceWithVat,
} = require("../src/services/moyskladCatalogService");

test("catalog narxiga 12 foiz NDS qo'shiladi", () => {
  assert.equal(calculatePriceWithVat(18000), 20160);
});

test("NDS qo'shilgan catalog narxi butun so'mga yaxlitlanadi", () => {
  assert.equal(calculatePriceWithVat(10000.5), 11201);
});
