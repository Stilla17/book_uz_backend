const API_PREFIX = "/api/v1";

const jsonResponse = {
  description: "JSON response",
  content: {
    "application/json": {
      schema: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
};

const endpoints = [
  ["post", "/auth/register", "Auth", "Foydalanuvchini ro'yxatdan o'tkazish"],
  ["post", "/auth/login", "Auth", "Tizimga kirish"],
  ["post", "/auth/refresh", "Auth", "Tokenni yangilash"],
  ["post", "/auth/logout", "Auth", "Tizimdan chiqish"],
  ["post", "/auth/forgot-password", "Auth", "Parolni tiklash uchun OTP yuborish"],
  ["post", "/auth/reset-password", "Auth", "Parolni OTP orqali tiklash"],

  ["get", "/products", "Products", "Kitoblar ro'yxatini olish"],
  ["get", "/products/new-arrivals", "Products", "Yangi kelgan kitoblar"],
  ["get", "/products/{id}", "Products", "Kitob tafsilotlari"],
  ["get", "/products/{id}/related", "Products", "O'xshash kitoblar"],
  ["get", "/search/suggestions", "Search", "Qidiruv takliflari"],

  ["get", "/categories", "Categories", "Kategoriyalar ro'yxati"],
  ["get", "/categories/tree", "Categories", "Kategoriyalar daraxti"],
  ["get", "/categories/{slug}", "Categories", "Kategoriya tafsiloti"],
  ["get", "/categories/{slug}/products", "Categories", "Kategoriya bo'yicha kitoblar"],
  ["get", "/authors", "Authors", "Mualliflar ro'yxati"],
  ["get", "/authors/{id}", "Authors", "Muallif tafsiloti"],
  ["get", "/authors/{id}/products", "Authors", "Muallif kitoblari"],
  ["get", "/publishers", "Publishers", "Nashriyotlar ro'yxati"],
  ["get", "/publishers/{id}", "Publishers", "Nashriyot tafsiloti"],
  ["get", "/publishers/{id}/products", "Publishers", "Nashriyot kitoblari"],
  ["get", "/banners", "Banners", "Faol bannerlar"],
  ["post", "/banners/{id}/view", "Banners", "Banner ko'rilishini yozish"],
  ["post", "/banners/{id}/click", "Banners", "Banner bosilishini yozish"],
  ["get", "/locations/regions", "Locations", "Viloyatlar ro'yxati"],
  ["get", "/locations/districts", "Locations", "Tumanlar ro'yxati"],
  ["get", "/locations/regions/{regionId}", "Locations", "Viloyat tafsiloti"],
  ["get", "/locations/regions/{regionId}/districts", "Locations", "Viloyat tumanlari"],
  ["get", "/comments/book/{bookId}", "Comments", "Kitob kommentlari"],
  ["post", "/comments", "Comments", "Komment qoldirish", true],

  ["post", "/orders", "Orders", "Buyurtma yaratish"],
  ["get", "/orders/my-orders", "Orders", "Mening buyurtmalarim", true],
  ["get", "/orders/{id}", "Orders", "Buyurtma tafsiloti", true],
  ["put", "/orders/{id}/cancel", "Orders", "Buyurtmani bekor qilish", true],
  ["post", "/orders/{id}/reorder", "Orders", "Qayta buyurtma berish", true],
  ["get", "/cart", "Cart", "Savatni olish", true],
  ["post", "/cart/add", "Cart", "Savatga qo'shish", true],
  ["patch", "/cart/update", "Cart", "Savatdagi miqdorni o'zgartirish", true],
  ["delete", "/cart/remove/{productId}", "Cart", "Savatdan mahsulotni o'chirish", true],
  ["delete", "/cart/clear", "Cart", "Savatni tozalash", true],
  ["post", "/coupons/apply", "Coupons", "Kuponni qo'llash", true],
  ["get", "/subscription/plans", "Subscriptions", "Obuna tariflari"],
  ["get", "/subscription/my", "Subscriptions", "Mening obunam", true],
  ["post", "/subscription/subscribe", "Subscriptions", "Obunaga ulanish", true],
  ["delete", "/subscription/{id}/cancel", "Subscriptions", "Obunani bekor qilish", true],
  ["get", "/subscription/history", "Subscriptions", "Obuna tarixi", true],
  ["get", "/subscription/check-access", "Subscriptions", "Obuna ruxsatini tekshirish", true],
  ["post", "/reviews", "Reviews", "Sharh qoldirish", true, true],
  ["put", "/reviews/{id}", "Reviews", "Sharhni tahrirlash", true],
  ["delete", "/reviews/{id}", "Reviews", "Sharhni o'chirish", true],
  ["post", "/my-reviews", "Reviews", "Sharh qoldirish", true, true],
  ["put", "/my-reviews/{id}", "Reviews", "Sharhni tahrirlash", true],
  ["delete", "/my-reviews/{id}", "Reviews", "Sharhni o'chirish", true],

  ["patch", "/users/profile", "Users", "Profilni yangilash", true, true],
  ["patch", "/users/update-profile", "Users", "Profilni yangilash", true, true],
  ["patch", "/users/update-password", "Users", "Parolni o'zgartirish", true],
  ["get", "/users/wishlist", "Users", "Wishlist tafsilotlari", true],
  ["post", "/users/wishlist/toggle", "Users", "Wishlistga qo'shish yoki o'chirish", true],
  ["post", "/users/wishlist/merge", "Users", "Wishlistni birlashtirish", true],
  ["get", "/users/addresses", "Users", "Manzillar ro'yxati", true],
  ["post", "/users/address", "Users", "Manzil qo'shish", true],
  ["delete", "/users/address/{addressId}", "Users", "Manzilni o'chirish", true],
  ["get", "/users/notifications", "Users", "Xabarnoma sozlamalari", true],
  ["put", "/users/notifications", "Users", "Xabarnoma sozlamalarini yangilash", true],
  ["get", "/users/security", "Users", "Xavfsizlik sozlamalari", true],
  ["put", "/users/security", "Users", "Xavfsizlik sozlamalarini yangilash", true],
  ["get", "/users/preferences", "Users", "Til va mintaqa sozlamalari", true],
  ["put", "/users/preferences", "Users", "Til va mintaqa sozlamalarini yangilash", true],
  ["get", "/users/devices", "Users", "Faol qurilmalar", true],
  ["delete", "/users/devices/{deviceId}", "Users", "Qurilmani o'chirish", true],
  ["delete", "/users/account", "Users", "Hisobni o'chirish", true],

  ["post", "/click/prepare", "Click", "Click prepare callback"],
  ["post", "/click/complete", "Click", "Click complete callback"],
  ["post", "/click/create-order", "Click", "Click orqali buyurtma yaratish", true],
  ["get", "/click/order-status/{orderId}", "Click", "Click buyurtma holati", true],
  ["post", "/payme", "Payme", "Payme webhook"],

  ["get", "/admin/dashboard/stats", "Admin Dashboard", "Dashboard statistikasi", true],
  ["get", "/admin/dashboard/sales-chart", "Admin Dashboard", "Sotuv grafigi", true],
  ["get", "/admin/dashboard/top-products", "Admin Dashboard", "Top mahsulotlar", true],
  ["get", "/admin/dashboard/payment-stats", "Admin Dashboard", "To'lov statistikasi", true],
  ["get", "/admin/dashboard/inventory", "Admin Dashboard", "Ombor hisoboti", true],
  ["get", "/admin/dashboard/user-analytics", "Admin Dashboard", "Foydalanuvchi analitikasi", true],

  ["get", "/admin/products", "Admin Products", "Admin kitoblar ro'yxati", true],
  ["get", "/admin/products/search", "Admin Products", "Admin kitob qidiruvi", true],
  ["get", "/admin/products/{id}", "Admin Products", "Admin kitob tafsiloti", true],
  ["post", "/admin/products", "Admin Products", "Kitob yaratish", true, true],
  ["patch", "/admin/products/{id}", "Admin Products", "Kitobni yangilash", true, true],
  ["patch", "/admin/products/{id}/stock", "Admin Products", "Kitob zaxirasini yangilash", true],
  ["patch", "/admin/products/{id}/toggle-top", "Admin Products", "Top holatini almashtirish", true],
  ["delete", "/admin/products/{id}", "Admin Products", "Kitobni o'chirish", true],
  ["delete", "/admin/products/{id}/image", "Admin Products", "Kitob rasmini o'chirish", true],

  ["get", "/admin/authors", "Admin Authors", "Admin mualliflar ro'yxati", true],
  ["get", "/admin/authors/{id}", "Admin Authors", "Admin muallif tafsiloti", true],
  ["post", "/admin/authors", "Admin Authors", "Muallif yaratish", true, true],
  ["patch", "/admin/authors/{id}", "Admin Authors", "Muallifni yangilash", true, true],
  ["delete", "/admin/authors/{id}", "Admin Authors", "Muallifni o'chirish", true],
  ["get", "/admin/categories", "Admin Categories", "Admin kategoriyalar ro'yxati", true],
  ["post", "/admin/categories", "Admin Categories", "Kategoriya yaratish", true, true],
  ["patch", "/admin/categories/{id}", "Admin Categories", "Kategoriyani yangilash", true, true],
  ["delete", "/admin/categories/{id}", "Admin Categories", "Kategoriyani o'chirish", true],
  ["patch", "/admin/categories/{id}/toggle-status", "Admin Categories", "Kategoriya holatini almashtirish", true],
  ["patch", "/admin/categories/{id}/toggle-featured", "Admin Categories", "Featured holatini almashtirish", true],
  ["post", "/admin/categories/sub", "Admin Categories", "Subkategoriya qo'shish", true],
  ["delete", "/admin/categories/{categoryId}/sub/{subId}", "Admin Categories", "Subkategoriya o'chirish", true],
  ["get", "/admin/banners", "Admin Banners", "Admin bannerlar ro'yxati", true],
  ["get", "/admin/banners/{id}", "Admin Banners", "Admin banner tafsiloti", true],
  ["post", "/admin/banners", "Admin Banners", "Banner yaratish", true, true],
  ["patch", "/admin/banners/{id}", "Admin Banners", "Bannerni yangilash", true, true],
  ["delete", "/admin/banners/{id}", "Admin Banners", "Bannerni o'chirish", true],
  ["patch", "/admin/banners/{id}/toggle-status", "Admin Banners", "Banner holatini almashtirish", true],
  ["post", "/admin/banners/reorder", "Admin Banners", "Banner tartibini yangilash", true],
  ["get", "/admin/publishers", "Admin Publishers", "Admin nashriyotlar ro'yxati", true],
  ["get", "/admin/publishers/{id}", "Admin Publishers", "Admin nashriyot tafsiloti", true],
  ["post", "/admin/publishers", "Admin Publishers", "Nashriyot yaratish", true, true],
  ["patch", "/admin/publishers/{id}", "Admin Publishers", "Nashriyotni yangilash", true, true],
  ["delete", "/admin/publishers/{id}", "Admin Publishers", "Nashriyotni o'chirish", true],
  ["get", "/admin/users", "Admin Users", "Foydalanuvchilar ro'yxati", true],
  ["get", "/admin/users/{id}", "Admin Users", "Foydalanuvchi tafsiloti", true],
  ["patch", "/admin/users/{id}/update", "Admin Users", "Foydalanuvchini yangilash", true],
  ["patch", "/admin/users/{id}/reset-password", "Admin Users", "Foydalanuvchi parolini tiklash", true],
  ["delete", "/admin/users/{id}", "Admin Users", "Foydalanuvchini o'chirish", true],
  ["get", "/admin/orders", "Admin Orders", "Buyurtmalar ro'yxati", true],
  ["patch", "/admin/orders/{id}/status", "Admin Orders", "Buyurtma statusini yangilash", true],
  ["delete", "/admin/orders/{id}", "Admin Orders", "Buyurtmani o'chirish", true],
  ["post", "/admin/coupons", "Admin Coupons", "Kupon yaratish", true],
  ["get", "/admin/coupons", "Admin Coupons", "Kuponlar ro'yxati", true],
  ["delete", "/admin/coupons/{id}", "Admin Coupons", "Kuponni o'chirish", true],
  ["get", "/admin/reviews", "Admin Reviews", "Sharhlar ro'yxati", true],
  ["get", "/admin/reviews/stats", "Admin Reviews", "Sharh statistikasi", true],
  ["patch", "/admin/reviews/{id}/moderate", "Admin Reviews", "Sharhni moderatsiya qilish", true],
  ["patch", "/admin/reviews/{id}/reply", "Admin Reviews", "Sharhga javob berish", true],
  ["get", "/admin/comments", "Admin Comments", "Kommentlar ro'yxati", true],
  ["patch", "/admin/comments/{id}/status", "Admin Comments", "Komment statusini yangilash", true],
  ["delete", "/admin/comments/{id}", "Admin Comments", "Kommentni o'chirish", true],
  ["get", "/admin/subscriptions", "Admin Subscriptions", "Obunalar ro'yxati", true],
  ["get", "/admin/subscriptions/{id}", "Admin Subscriptions", "Obuna tafsiloti", true],
  ["post", "/admin/subscriptions", "Admin Subscriptions", "Obuna yaratish", true],
  ["put", "/admin/subscriptions/{id}", "Admin Subscriptions", "Obunani yangilash", true],
  ["delete", "/admin/subscriptions/{id}", "Admin Subscriptions", "Obunani o'chirish", true],
  ["patch", "/admin/subscriptions/{id}/toggle", "Admin Subscriptions", "Obuna holatini almashtirish", true],
  ["post", "/admin/subscriptions/update-order", "Admin Subscriptions", "Obuna tartibini yangilash", true],
];

function pathParameters(pathname) {
  const matches = pathname.matchAll(/\{([^}]+)\}/g);

  return Array.from(matches).map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
}

function requestBody(isMultipart) {
  return {
    required: false,
    content: {
      [isMultipart ? "multipart/form-data" : "application/json"]: {
        schema: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
  };
}

function buildOperation([method, pathname, tag, summary, isProtected, isMultipart]) {
  const operation = {
    tags: [tag],
    summary,
    parameters: pathParameters(pathname),
    responses: {
      200: jsonResponse,
      201: jsonResponse,
      400: jsonResponse,
      401: jsonResponse,
      404: jsonResponse,
      500: jsonResponse,
    },
  };

  if (isProtected) {
    operation.security = [{ bearerAuth: [] }];
  }

  if (!["get", "delete"].includes(method)) {
    operation.requestBody = requestBody(isMultipart);
  }

  return operation;
}

function buildPaths() {
  return endpoints.reduce((paths, endpoint) => {
    const [method, pathname] = endpoint;
    const fullPath = `${API_PREFIX}${pathname}`;

    paths[fullPath] = paths[fullPath] || {};
    paths[fullPath][method] = buildOperation(endpoint);

    return paths;
  }, {});
}

const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Book Uz API",
    version: "1.0.0",
    description: "Online Book Store backend API hujjatlari.",
  },
  servers: [
    {
      url: "http://localhost:5000",
      description: "Local server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  paths: buildPaths(),
};

const swaggerHtml = `<!doctype html>
<html lang="uz">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Book Uz API Docs</title>
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
        url: "/api-docs.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        persistAuthorization: true,
        displayRequestDuration: true,
      });
    </script>
  </body>
</html>`;

module.exports = {
  openApiDocument,
  swaggerHtml,
};
