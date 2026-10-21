const test = require("node:test");
const assert = require("node:assert/strict");

const {
  hasUnlimitedStock,
  hasEnoughStock,
} = require("../src/utils/productStock");

test('MoySklad external code "-" marks a product as unlimited stock', () => {
  assert.equal(hasUnlimitedStock({ moyskladExternalCode: "-" }), true);
  assert.equal(hasUnlimitedStock({ moyskladExternalCode: "  -  " }), true);
  assert.equal(hasUnlimitedStock({ moyskladExternalCode: "ABC-123" }), false);
});

test('products with MoySklad external code "-" can be purchased without stock', () => {
  assert.equal(
    hasEnoughStock({ moyskladExternalCode: "-", stock: 0 }, 5),
    true,
  );
  assert.equal(
    hasEnoughStock({ moyskladExternalCode: "ABC", stock: 0 }, 1),
    false,
  );
  assert.equal(
    hasEnoughStock({ moyskladExternalCode: "ABC", stock: 2 }, 2),
    true,
  );
});
