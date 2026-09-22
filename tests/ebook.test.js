const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { Readable, Writable } = require("node:stream");
const express = require("express");
const https = require("https");
const jwt = require("jsonwebtoken");

const Product = require("../src/models/Product");
const Order = require("../src/models/Order");
const Counter = require("../src/models/Counter");
const User = require("../src/models/User");
const cloudinary = require("../src/config/cloudinary");
const adminEbookController = require("../src/controllers/admin/ebookController");

test("admin upload sets ebook access to purchase and price to 50 percent", async () => {
  const productId = "111111111111111111111111";
  const product = {
    _id: productId,
    price: 100000,
    ebook: {},
  };
  const epub = Buffer.alloc(58);
  epub.writeUInt32LE(0x04034b50, 0);
  epub.writeUInt16LE(8, 26);
  epub.writeUInt32LE(20, 18);
  epub.write("mimetype", 30, "ascii");
  epub.write("application/epub+zip", 38, "ascii");

  let savedEbook = null;
  const originalFindById = Product.findById;
  const originalFindOneAndUpdate = Product.findOneAndUpdate;
  const originalUploadStream = cloudinary.uploader.upload_stream;

  Product.findById = () => ({ select: async () => product });
  Product.findOneAndUpdate = (filter, update) => ({
    select: async () => {
      savedEbook = update.$set.ebook;
      return { _id: productId };
    },
  });
  cloudinary.uploader.upload_stream = (options, callback) =>
    new Writable({
      write(chunk, encoding, done) {
        done();
      },
      final(done) {
        callback(null, {
          public_id: "ebook-storage-key",
          secure_url: "https://cdn.example.test/test.epub",
        });
        done();
      },
    });

  const req = {
    params: { id: productId },
    file: {
      buffer: epub,
      originalname: "test.epub",
      size: epub.length,
    },
  };
  const responseResult = {};
  const res = {
    status(statusCode) {
      responseResult.statusCode = statusCode;
      return this;
    },
    json(body) {
      responseResult.body = body;
      return this;
    },
  };

  try {
    await adminEbookController.uploadEbook(req, res, (error) => {
      throw error;
    });

    assert.equal(responseResult.statusCode, 201);
    assert.equal(savedEbook.price, 50000);
    assert.equal(savedEbook.access, "purchase");
    assert.equal(responseResult.body.data.ebook.price, 50000);
  } finally {
    Product.findById = originalFindById;
    Product.findOneAndUpdate = originalFindOneAndUpdate;
    cloudinary.uploader.upload_stream = originalUploadStream;
  }
});

test("ebook is half price and can only be read after payment", async () => {
  const oldSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = "local-ebook-test-secret";

  const productId = "111111111111111111111111";
  const userId = "222222222222222222222222";
  const orderId = "333333333333333333333333";
  const epub = Buffer.from("test epub body");
  const product = {
    _id: productId,
    isActive: true,
    price: 100000,
    ebook: {
      storageKey: "ebook-storage-key",
      originalName: "test.epub",
      price: 50000,
      access: "purchase",
      url: "https://cdn.example.test/test.epub",
    },
  };

  let paid = false;
  let createdOrder = null;
  const restore = [];
  const replace = (object, key, replacement) => {
    const original = object[key];
    object[key] = replacement;
    restore.push(() => {
      object[key] = original;
    });
  };

  replace(User, "findById", (id) => ({
    select: async () => ({ _id: id, role: "USER" }),
  }));
  replace(Product, "findOne", async () => product);
  replace(Order, "findOne", async (query) => {
    if (query.paymentStatus === "PAID" && paid) {
      return { _id: orderId };
    }
    return null;
  });
  replace(Order, "exists", async () => (paid ? { _id: orderId } : null));
  replace(Counter, "findOneAndUpdate", async () => ({ sequence: 101 }));
  replace(Order, "create", async (data) => {
    createdOrder = data;
    return {
      _id: orderId,
      ...data,
    };
  });
  replace(https, "get", (url, callback) => {
    assert.equal(url, product.ebook.url);
    const response = Readable.from(epub);
    response.statusCode = 200;
    response.headers = {};
    process.nextTick(() => callback(response));
    return new EventEmitter();
  });

  const app = express();
  app.use(express.json());
  app.use("/products", require("../src/routes/user/productRoutes"));
  app.use(require("../src/middlewares/error").errorHandler);

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const authorization = {
    Authorization: `Bearer ${jwt.sign(
      { id: userId },
      process.env.JWT_ACCESS_SECRET,
    )}`,
  };

  try {
    let response = await fetch(`${baseUrl}/products/${productId}/ebook`);
    assert.equal(response.status, 401);

    response = await fetch(`${baseUrl}/products/${productId}/ebook`, {
      headers: authorization,
    });
    assert.equal(response.status, 403);

    response = await fetch(
      `${baseUrl}/products/${productId}/ebook/purchase`,
      {
        method: "POST",
        headers: {
          ...authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentType: "PAYME" }),
      },
    );
    assert.equal(response.status, 201);

    const purchaseResponse = await response.json();
    assert.equal(purchaseResponse.data.amount, 50000);
    assert.equal(createdOrder.totalAmount, product.price / 2);
    assert.equal(createdOrder.items[0].itemType, "EBOOK");
    assert.equal(createdOrder.deliveryFee, 0);

    paid = true;
    response = await fetch(`${baseUrl}/products/${productId}/ebook`, {
      headers: authorization,
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/epub+zip");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), epub);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const restoreFunction of restore.reverse()) restoreFunction();

    if (oldSecret === undefined) {
      delete process.env.JWT_ACCESS_SECRET;
    } else {
      process.env.JWT_ACCESS_SECRET = oldSecret;
    }
  }
});
