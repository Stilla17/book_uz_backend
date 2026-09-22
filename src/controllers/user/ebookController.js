const https = require("https");
const Product = require("../../models/Product");
const Order = require("../../models/Order");
const Counter = require("../../models/Counter");
const apiResponse = require("../../utils/apiResponse");
const { buildClickUrl } = require("../../payment/click/clickService");
const { buildPaymeCheckoutUrl } = require("../../payment/payme/paymeService");

const findProduct = async (id) => {
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    const error = new Error("Kitob ID noto'g'ri");
    error.statusCode = 400;
    throw error;
  }

  return Product.findOne({
    _id: id,
    isActive: true,
  });
};

const getPaymentData = (order) => {
  if (order.paymentType === "CLICK") {
    const redirectUrl = buildClickUrl(order._id.toString(), order.totalAmount);

    return {
      type: "CLICK_REDIRECT",
      redirectUrl,
    };
  }

  const redirectUrl = buildPaymeCheckoutUrl(order._id.toString());

  return {
    type: "PAYME_REDIRECT",
    redirectUrl,
  };
};

// Elektron kitob uchun buyurtma yaratish
exports.purchaseEbook = async (req, res, next) => {
  try {
    const product = await findProduct(req.params.id);

    if (!product?.ebook?.url || !product?.ebook?.storageKey) {
      return apiResponse(res, 404, false, "Elektron kitob mavjud emas");
    }

    const paymentType = String(req.body.paymentType || "").toUpperCase();

    if (!["CLICK", "PAYME"].includes(paymentType)) {
      return apiResponse(
        res,
        400,
        false,
        "paymentType CLICK yoki PAYME bo'lishi kerak",
      );
    }

    const paidOrder = await Order.findOne({
      user: req.user._id,
      paymentStatus: "PAID",
      items: {
        $elemMatch: {
          product: product._id,
          itemType: "EBOOK",
        },
      },
    });

    if (paidOrder) {
      return apiResponse(res, 200, true, "Elektron kitob avval sotib olingan", {
        hasAccess: true,
        orderId: paidOrder._id,
      });
    }

    // Bir xil to'lanmagan buyurtmani qayta yaratmaslik
    let order = await Order.findOne({
      user: req.user._id,
      paymentStatus: "PENDING",
      status: "PENDING",
      paymentType,
      items: {
        $elemMatch: {
          product: product._id,
          itemType: "EBOOK",
        },
      },
    });

    if (!order) {
      const counter = await Counter.findOneAndUpdate(
        { _id: "orderNumber" },
        { $inc: { sequence: 1 } },
        {
          new: true,
          upsert: true,
        },
      );

      const ebookPrice = Math.round(
        Number(product.ebook.price || product.price * 0.5),
      );

      if (!Number.isFinite(ebookPrice) || ebookPrice <= 0) {
        return apiResponse(res, 400, false, "Elektron kitob narxi noto'g'ri");
      }

      order = await Order.create({
        orderNumber: counter.sequence,
        user: req.user._id,
        items: [
          {
            product: product._id,
            quantity: 1,
            priceAtTime: ebookPrice,
            itemType: "EBOOK",
          },
        ],
        totalAmount: ebookPrice,
        deliveryFee: 0,
        deliveryType: "PICKUP",
        paymentType,
        paymentStatus: "PENDING",
        status: "PENDING",
        description: "Elektron kitob xaridi",
      });
    }

    return apiResponse(
      res,
      201,
      true,
      "Elektron kitob uchun to'lov yaratildi",
      {
        orderId: order._id,
        amount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        payment: getPaymentData(order),
      },
    );
  } catch (error) {
    next(error);
  }
};

// Foydalanuvchi elektron kitobni sotib olganini tekshirish
exports.getEbookAccess = async (req, res, next) => {
  try {
    const product = await findProduct(req.params.id);

    if (!product?.ebook?.url || !product?.ebook?.storageKey) {
      return apiResponse(res, 404, false, "Elektron kitob mavjud emas");
    }

    const isAdmin = ["ADMIN", "SUPERADMIN"].includes(
      String(req.user.role || "").toUpperCase(),
    );

    if (isAdmin) {
      return apiResponse(res, 200, true, "Elektron kitobga ruxsat mavjud", {
        hasAccess: true,
        ebookPrice: product.ebook.price,
      });
    }

    const paidOrder = await Order.exists({
      user: req.user._id,
      paymentStatus: "PAID",
      items: {
        $elemMatch: {
          product: product._id,
          itemType: "EBOOK",
        },
      },
    });
    return apiResponse(res, 200, true, "Elektron kitob ruxsati", {
      hasAccess: Boolean(paidOrder),
      ebookPrice: product.ebook.price,
    });
  } catch (error) {
    next(error);
  }
};

// Faqat to'lagan foydalanuvchi o'qiy oladi
exports.readEbook = async (req, res, next) => {
  try {
    const product = await findProduct(req.params.id);

    if (!product?.ebook?.url || !product?.ebook?.storageKey) {
      return apiResponse(res, 404, false, "Elektron kitob topilmadi");
    }

    const isAdmin = ["ADMIN", "SUPERADMIN"].includes(
      String(req.user.role).toUpperCase(),
    );

    if (!isAdmin) {
      const paidOrder = await Order.exists({
        user: req.user._id,
        paymentStatus: "PAID",
        items: {
          $elemMatch: {
            product: product._id,
            itemType: "EBOOK",
          },
        },
      });

      if (!paidOrder) {
        return apiResponse(
          res,
          403,
          false,
          "Kitobni o'qish uchun avval sotib olishingiz kerak",
          {
            ebookPrice: product.ebook.price,
            hasAccess: false,
          },
        );
      }
    }

    res.setHeader("Content-Type", "application/epub+zip");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${product.ebook.originalName || "ebook.epub"}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    https
      .get(product.ebook.url, (cloudRes) => {
        if (
          cloudRes.statusCode >= 300 &&
          cloudRes.statusCode < 400 &&
          cloudRes.headers.location
        ) {
          https
            .get(cloudRes.headers.location, (redirectRes) => {
              redirectRes.pipe(res);
            })
            .on("error", next);

          return;
        }

        cloudRes.pipe(res);
      })
      .on("error", next);
  } catch (error) {
    next(error);
  }
};
