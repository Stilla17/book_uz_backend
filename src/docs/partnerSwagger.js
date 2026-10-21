const PRODUCTION_URL = "https://backend.book.uz";

const localizedTextSchema = {
  type: "object",
  properties: {
    uz: { type: "string" },
    ru: { type: "string" },
    en: { type: "string" },
  },
};

const errorResponse = (description) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
    },
  },
});

const partnerOpenApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Book.uz Partner API",
    version: "1.0.0",
    description:
      "Hamkor saytlar uchun cheklangan API hujjati. Bu hujjatda faqat mahsulotlarni olish, buyurtma yaratish va Click/Payme to'lovini boshlash endpointlari mavjud.",
  },
  servers: [
    { url: PRODUCTION_URL, description: "Production" },
    { url: "http://localhost:5000", description: "Local development" },
  ],
  tags: [
    { name: "Products", description: "Mahsulotlar katalogi" },
    { name: "Orders", description: "Buyurtma yaratish" },
    { name: "Payments", description: "To'lov sahifasiga yo'naltirish" },
  ],
  paths: {
    "/api/v1/products": {
      get: {
        tags: ["Products"],
        summary: "Mahsulotlar ro'yxatini olish",
        operationId: "getPartnerProducts",
        parameters: [
          {
            name: "page",
            in: "query",
            description: "Sahifa raqami",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "limit",
            in: "query",
            description: "Bir sahifadagi mahsulotlar soni",
            schema: { type: "integer", minimum: 1, default: 20 },
          },
          {
            name: "keyword",
            in: "query",
            description: "Nomi yoki tavsifi bo'yicha qidiruv",
            schema: { type: "string" },
          },
          {
            name: "category",
            in: "query",
            description: "Kategoriya ID, slug yoki nomi. Bir nechtasi vergul bilan ajratiladi.",
            schema: { type: "string" },
          },
          {
            name: "author",
            in: "query",
            description: "Muallif ID, slug yoki nomi",
            schema: { type: "string" },
          },
          {
            name: "publisher",
            in: "query",
            description: "Nashriyot ID, slug yoki nomi",
            schema: { type: "string" },
          },
          {
            name: "minPrice",
            in: "query",
            schema: { type: "number", minimum: 0 },
          },
          {
            name: "maxPrice",
            in: "query",
            schema: { type: "number", minimum: 0 },
          },
          {
            name: "sort",
            in: "query",
            schema: {
              type: "string",
              enum: ["price_asc", "price_desc", "rating"],
            },
          },
          {
            name: "language",
            in: "query",
            schema: { type: "string", enum: ["uz", "ru", "en"] },
          },
          {
            name: "contentLanguage",
            in: "query",
            schema: { type: "string", enum: ["latin", "cyrillic"] },
          },
        ],
        responses: {
          200: {
            description: "Mahsulotlar ro'yxati",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            products: {
                              type: "array",
                              items: { $ref: "#/components/schemas/Product" },
                            },
                            pagination: {
                              $ref: "#/components/schemas/Pagination",
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: errorResponse("So'rov parametrlari noto'g'ri"),
          500: errorResponse("Server xatosi"),
        },
      },
    },
    "/api/v1/orders": {
      post: {
        tags: ["Orders"],
        summary: "Buyurtma yaratish",
        description:
          "Guest buyurtmada `items` va mijoz ma'lumotlari yuboriladi. JWT yuborilgan foydalanuvchida savatdagi mahsulotlar ishlatilishi mumkin.",
        operationId: "createPartnerOrder",
        security: [{ bearerAuth: [] }, {}],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateOrderRequest" },
              examples: {
                guestClickOrder: {
                  summary: "Guest Click buyurtmasi",
                  value: {
                    guestName: "Ali Valiyev",
                    items: [
                      { product: "507f1f77bcf86cd799439011", quantity: 1 },
                    ],
                    shippingAddress: {
                      region: "Toshkent shahri",
                      city: "Toshkent",
                      street: "Amir Temur ko'chasi 1",
                      phone: "+998901234567",
                    },
                    deliveryType: "DELIVERY",
                    paymentType: "CLICK",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Buyurtma yaratildi",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Order" },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: errorResponse("Buyurtma ma'lumotlari noto'g'ri"),
          401: errorResponse("JWT token noto'g'ri"),
          500: errorResponse("Server xatosi"),
        },
      },
    },
    "/api/v1/click/create-order": {
      post: {
        tags: ["Payments"],
        summary: "Click to'lov havolasini yaratish",
        description:
          "Faqat CLICK turi bilan yaratilgan va Bearer token egasiga tegishli buyurtma uchun ishlaydi.",
        operationId: "createClickPaymentUrl",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["orderId"],
                properties: {
                  orderId: {
                    type: "string",
                    description: "POST /orders javobidagi buyurtma `_id` si",
                    example: "507f1f77bcf86cd799439011",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Click redirect havolasi yaratildi",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PaymentUrlResponse" },
              },
            },
          },
          400: errorResponse("Buyurtmani Click orqali to'lab bo'lmaydi"),
          401: errorResponse("Bearer token talab qilinadi"),
          403: errorResponse("Buyurtma boshqa foydalanuvchiga tegishli"),
          404: errorResponse("Buyurtma topilmadi"),
          500: errorResponse("Server xatosi"),
        },
      },
    },
    "/api/v1/payme/checkout/{orderId}": {
      get: {
        tags: ["Payments"],
        summary: "Payme checkout sahifasini ochish",
        description:
          "PAYME turi bilan yaratilgan buyurtma uchun checkout HTML sahifasini qaytaradi va Payme'ga yo'naltiradi.",
        operationId: "openPaymeCheckout",
        parameters: [
          {
            name: "orderId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "POST /orders javobidagi buyurtma `_id` si",
          },
        ],
        responses: {
          200: {
            description: "Payme checkout HTML sahifasi",
            content: {
              "text/html": { schema: { type: "string" } },
            },
          },
          400: {
            description: "Buyurtmani Payme orqali to'lab bo'lmaydi",
            content: { "text/plain": { schema: { type: "string" } } },
          },
          404: {
            description: "Buyurtma topilmadi",
            content: { "text/plain": { schema: { type: "string" } } },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Book.uz foydalanuvchi access tokeni",
      },
    },
    schemas: {
      SuccessResponse: {
        type: "object",
        required: ["success", "message", "timestamp"],
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      Product: {
        type: "object",
        properties: {
          _id: { type: "string" },
          title: localizedTextSchema,
          slug: { type: "string" },
          description: localizedTextSchema,
          price: { type: "number" },
          discountPrice: { type: "number" },
          image: { type: "string", format: "uri" },
          stock: { type: "integer" },
          language: { type: "string", enum: ["uz", "ru", "en"] },
          contentLanguage: {
            type: "string",
            enum: ["latin", "cyrillic"],
          },
          ratingAvg: { type: "number" },
          ratingCount: { type: "integer" },
          isWishlisted: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        additionalProperties: true,
      },
      Pagination: {
        type: "object",
        properties: {
          total: { type: "integer" },
          page: { type: "integer" },
          pages: { type: "integer" },
        },
      },
      OrderItemRequest: {
        type: "object",
        required: ["product", "quantity"],
        properties: {
          product: { type: "string", description: "Mahsulot `_id` si" },
          quantity: { type: "integer", minimum: 1 },
        },
      },
      ShippingAddress: {
        type: "object",
        required: ["phone"],
        properties: {
          fullName: { type: "string" },
          region: { type: "string" },
          regionId: { type: "string" },
          city: { type: "string" },
          street: { type: "string" },
          phone: { type: "string", example: "+998901234567" },
        },
      },
      CreateOrderRequest: {
        type: "object",
        required: ["shippingAddress", "deliveryType", "paymentType", "items"],
        properties: {
          guestName: { type: "string" },
          items: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/OrderItemRequest" },
          },
          shippingAddress: { $ref: "#/components/schemas/ShippingAddress" },
          deliveryType: {
            type: "string",
            enum: ["PICKUP", "DELIVERY", "POST"],
          },
          postDeliveryType: {
            type: "string",
            enum: ["POST_OFFICE", "POST_TO_HOME"],
            description: "deliveryType POST bo'lganda ishlatiladi",
          },
          paymentType: {
            type: "string",
            enum: ["CASH", "CLICK", "UZUM", "PAYME", "XAZNA"],
          },
          description: { type: "string" },
          couponCode: { type: "string" },
        },
      },
      OrderItem: {
        type: "object",
        properties: {
          product: { type: "string" },
          quantity: { type: "integer" },
          priceAtTime: { type: "number" },
          itemType: { type: "string", enum: ["PHYSICAL", "EBOOK"] },
        },
      },
      PaymentRedirect: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["CLICK_REDIRECT", "PAYME_REDIRECT"] },
          redirectUrl: { type: "string", format: "uri" },
        },
      },
      Order: {
        type: "object",
        properties: {
          _id: { type: "string" },
          orderNumber: { type: "integer" },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/OrderItem" },
          },
          totalAmount: { type: "number" },
          deliveryFee: { type: "number" },
          discountAmount: { type: "number" },
          paymentType: { type: "string" },
          paymentStatus: { type: "string", enum: ["PENDING", "PAID", "FAILED"] },
          status: {
            type: "string",
            enum: ["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"],
          },
          clickUrl: { type: "string", format: "uri" },
          paymeUrl: { type: "string", format: "uri" },
          payment: { $ref: "#/components/schemas/PaymentRedirect" },
          createdAt: { type: "string", format: "date-time" },
        },
        additionalProperties: true,
      },
      PaymentUrlResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          orderId: { type: "string" },
          amount: { type: "number" },
          clickUrl: { type: "string", format: "uri" },
          payment: { $ref: "#/components/schemas/PaymentRedirect" },
        },
      },
    },
  },
};

const partnerSwaggerHtml = `<!doctype html>
<html lang="uz">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Book.uz Partner API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #f7f7f7; }
      .swagger-ui .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/partner-api-docs.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        persistAuthorization: false,
        displayRequestDuration: true,
        tryItOutEnabled: true,
      });
    </script>
  </body>
</html>`;

module.exports = {
  partnerOpenApiDocument,
  partnerSwaggerHtml,
};
