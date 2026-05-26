const accountKey = process.env.PAYME_ACCOUNT_KEY || "order_id";

module.exports = {
  KASSA_ID: process.env.PAYME_KASSA_ID,
  LOGIN: process.env.PAYME_LOGIN || "Paycom",
  PASSWORD: process.env.PAYME_PASSWORD,
  ACCOUNT_KEY: accountKey,
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
      message: "Invalid amount",
      data: "amount",
    },
    INVALID_ACCOUNT: {
      code: -31050,
      message: "Account not found",
      data: accountKey,
    },
    ORDER_NOT_ALLOWED: {
      code: -31008,
      message: "Operation cannot be performed",
      data: accountKey,
    },
    ORDER_WAITING_PAYMENT: {
      code: -31099,
      message: "Order is already waiting for payment",
      data: "transaction",
    },
    TRANSACTION_NOT_FOUND: {
      code: -31003,
      message: "Transaction not found",
      data: "transaction",
    },
    TRANSACTION_NOT_ALLOWED: {
      code: -31008,
      message: "Operation cannot be performed",
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
