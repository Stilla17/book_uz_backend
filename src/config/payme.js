module.exports = {
  KASSA_ID: process.env.PAYME_KASSA_ID,
  PASSWORD: process.env.PAYME_PASSWORD,
  CHECKOUT_URL: process.env.PAYME_CHECKOUT_URL || "https://checkout.paycom.uz",
  RETURN_URL:
    process.env.PAYME_RETURN_URL ||
    `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/payme/return`,

  STATE: {
    PENDING: 1,
    COMPLETED: 2,
    CANCELLED: -1,
    CANCELLED_AFTER_COMPLETE: -2,
  },

  ERROR: {
    INVALID_AMOUNT: {
      code: -31001,
      message: "Invalid payment amount",
      data: "amount",
    },
    INVALID_ACCOUNT: {
      code: -31050,
      message: "Order not found",
      data: "order_id",
    },
    ORDER_NOT_ALLOWED: {
      code: -31008,
      message: "Payment is not allowed for this order",
      data: "order_id",
    },
    TRANSACTION_NOT_FOUND: {
      code: -31003,
      message: "Transaction not found",
      data: "transaction",
    },
    TRANSACTION_NOT_ALLOWED: {
      code: -31008,
      message: "Transaction is not allowed",
      data: "transaction",
    },
    CANT_CANCEL_TRANSACTION: {
      code: -31007,
      message: "Cannot cancel transaction",
      data: "transaction",
    },
    INTERNAL_ERROR: {
      code: -32400,
      message: "Internal server error",
    },
  },
};
