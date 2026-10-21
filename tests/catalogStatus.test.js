const test = require("node:test");
const assert = require("node:assert/strict");

const Catalog = require("../src/models/Catalog");
const catalogController = require("../src/controllers/admin/catalogController");

const replace = (object, key, value) => {
  const original = object[key];
  object[key] = value;
  return () => {
    object[key] = original;
  };
};

const createResponse = () => {
  const result = {};

  return {
    result,
    response: {
      status(statusCode) {
        result.statusCode = statusCode;
        return this;
      },
      json(body) {
        result.body = body;
        return this;
      },
    },
  };
};

test("catalog statusini active dan inactive ga o'zgartiradi", async () => {
  let saved = false;
  const catalog = {
    isActive: true,
    async save() {
      saved = true;
    },
  };
  const restore = replace(Catalog, "findById", async () => catalog);
  const { result, response } = createResponse();

  try {
    await catalogController.toggleCatalogStatus(
      { params: { id: "catalog-id" } },
      response,
      (error) => {
        throw error;
      },
    );

    assert.equal(saved, true);
    assert.equal(catalog.isActive, false);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.data, catalog);
  } finally {
    restore();
  }
});

test("eski isActive maydoni yo'q catalogni inactive qiladi", async () => {
  const catalog = {
    async save() {},
  };
  const restore = replace(Catalog, "findById", async () => catalog);
  const { result, response } = createResponse();

  try {
    await catalogController.toggleCatalogStatus(
      { params: { id: "legacy-catalog-id" } },
      response,
      (error) => {
        throw error;
      },
    );

    assert.equal(catalog.isActive, false);
    assert.equal(result.statusCode, 200);
  } finally {
    restore();
  }
});

test("public catalog detail inactive elementni qaytarmaydi", async () => {
  let receivedFilter;
  const restore = replace(Catalog, "findOne", async (filter) => {
    receivedFilter = filter;
    return null;
  });
  const { result, response } = createResponse();

  try {
    await catalogController.getActiveCatalogById(
      { params: { id: "catalog-id" } },
      response,
      (error) => {
        throw error;
      },
    );

    assert.deepEqual(receivedFilter, {
      _id: "catalog-id",
      isActive: { $ne: false },
    });
    assert.equal(result.statusCode, 404);
  } finally {
    restore();
  }
});
