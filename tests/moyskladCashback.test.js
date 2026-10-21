const { test, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");

const originalGet = axios.get;
const originalToken = process.env.MOYSKLAD_API_KEY;

process.env.MOYSKLAD_API_KEY = "test-token";

const { getCashbackByPhone } = require("../src/services/moyskladCashbackService");

beforeEach(() => {
  axios.get = originalGet;
});

after(() => {
  axios.get = originalGet;

  if (originalToken === undefined) {
    delete process.env.MOYSKLAD_API_KEY;
  } else {
    process.env.MOYSKLAD_API_KEY = originalToken;
  }
});

test("cashback customer is looked up with an exact local phone filter", async () => {
  let requestedParams;

  axios.get = async (_url, config) => {
    requestedParams = config.params;
    return {
      data: {
        rows: [
          {
            id: "customer-1",
            name: "Madina",
            phone: "501718857",
            bonusPoints: 12500,
          },
        ],
      },
    };
  };

  const customer = await getCashbackByPhone("+998 50 171 88 57");

  assert.deepEqual(requestedParams, {
    filter: "phone=501718857",
    limit: 100,
  });
  assert.deepEqual(customer, {
    moyskladId: "customer-1",
    name: "Madina",
    phone: "+998501718857",
    bonusPoints: 12500,
  });
});

test("formatted MoySklad phones are found through the search fallback", async () => {
  const requests = [];

  axios.get = async (_url, config) => {
    requests.push(config.params);

    if (config.params.filter) {
      return { data: { rows: [] } };
    }

    return {
      data: {
        rows: [
          {
            id: "customer-2",
            name: "Odina",
            phone: "+998 (50) 171-88-57",
            bonusPoints: 500,
          },
        ],
      },
    };
  };

  const customer = await getCashbackByPhone("998501718857");

  assert.deepEqual(requests, [
    { filter: "phone=501718857", limit: 100 },
    { search: "501718857", limit: 100 },
  ]);
  assert.equal(customer.moyskladId, "customer-2");
  assert.equal(customer.bonusPoints, 500);
});

test("unknown phone returns the user-safe not-found error", async () => {
  axios.get = async () => ({ data: { rows: [] } });

  await assert.rejects(
    getCashbackByPhone("+998501112233"),
    /Bu telefon raqami MoySklad'da topilmadi/,
  );
});
