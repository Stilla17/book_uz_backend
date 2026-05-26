const Order = require("../models/Order");
const mongoose = require("mongoose");
const { STATE, ERROR, ACCOUNT_KEY } = require("../config/payme");
const PaymeTransaction = require("../models/PaymeTransaction");
const { buildPaymeCheckoutForm } = require("../payment/payme/paymeService");

const METHOD_NOT_FOUND = {
  code: -32601,
  message: "Method not found",
  data: null,
};
const TRANSACTION_TIMEOUT_MS = 12 * 60 * 60 * 1000;

const err = (res, id, error) => {
  const paymeError = error && typeof error === "object" ? error : ERROR.INTERNAL_ERROR;
  const message =
    paymeError.message && typeof paymeError.message === "object"
      ? paymeError.message.ru ||
        paymeError.message.uz ||
        paymeError.message.en ||
        "Payme error"
      : String(paymeError.message || "Payme error");

  return res.json({
    id,
    error: {
      code: paymeError.code,
      message,
      data: paymeError.data || null,
    },
  });
};
const ok = (res, id, result) => {
  return res.json({
    id,
    result,
  });
};

function getOrderId(account = {}) {
  const orderId =
    account[ACCOUNT_KEY] ||
    account.order_id ||
    account.orderId ||
    account.userId ||
    account.order;
  return typeof orderId === "string" ? orderId : null;
}

function amountInTiyin(amount) {
  return Math.round(Number(amount) * 100);
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function isTimedOut(createTime) {
  return Date.now() - Number(createTime || 0) > TRANSACTION_TIMEOUT_MS;
}

function isPayableOrder(order) {
  return (
    order.paymentType === "PAYME" &&
    order.paymentStatus === "PENDING" &&
    order.status === "PENDING"
  );
}

async function cancelTimedOutTransaction(transaction, order) {
  transaction.state = STATE.CANCELLED;
  transaction.cancelTime = Date.now();
  transaction.reason = 4;
  await transaction.save();

  if (order && order.status === "PENDING") {
    order.status = "CANCELLED";
    order.paymentStatus = "FAILED";
    await order.save();
  }
}

async function checkPerformTransaction(req, res) {
  const { id, params = {} } = req.body;
  const { amount, account } = params;
  const orderId = getOrderId(account);

  if (!orderId) {
    return err(res, id, ERROR.INVALID_ACCOUNT);
  }

  if (!isValidObjectId(orderId)) {
    return err(res, id, ERROR.INVALID_ACCOUNT);
  }

  const order = await Order.findById(orderId);

  if (!order) {
    return err(res, id, ERROR.INVALID_ACCOUNT);
  }

  if (!isPayableOrder(order)) {
    return err(res, id, ERROR.ORDER_NOT_ALLOWED);
  }

  if (amountInTiyin(order.totalAmount) !== Number(amount)) {
    return err(res, id, ERROR.INVALID_AMOUNT);
  }

  return ok(res, id, { allow: true });
}

async function createTransaction(req, res) {
  const { id, params = {} } = req.body;
  const { id: paymeId, time, amount, account } = params;
  const orderId = getOrderId(account);

  if (!orderId) {
    return err(res, id, ERROR.INVALID_ACCOUNT);
  }

  if (!paymeId) {
    return err(res, id, ERROR.TRANSACTION_NOT_ALLOWED);
  }

  if (!isValidObjectId(orderId)) {
    return err(res, id, ERROR.INVALID_ACCOUNT);
  }

  const order = await Order.findById(orderId);

  if (!order) {
    return err(res, id, ERROR.INVALID_ACCOUNT);
  }

  if (amountInTiyin(order.totalAmount) !== Number(amount)) {
    return err(res, id, ERROR.INVALID_AMOUNT);
  }

  const transaction = await PaymeTransaction.findOne({ paymeId });

  if (transaction) {
    if (
      String(transaction.orderId) !== String(order._id) ||
      Number(transaction.amount) !== Number(amount)
    ) {
      return err(res, id, ERROR.TRANSACTION_NOT_ALLOWED);
    }

    if (
      transaction.state === STATE.PENDING &&
      isTimedOut(transaction.createTime)
    ) {
      await cancelTimedOutTransaction(transaction, order);
      return err(res, id, ERROR.TRANSACTION_NOT_ALLOWED);
    }

    if (transaction.state !== STATE.PENDING) {
      return err(res, id, ERROR.TRANSACTION_NOT_ALLOWED);
    }

    return ok(res, id, {
      create_time: transaction.createTime,
      transaction: transaction.paymeId,
      state: transaction.state,
    });
  }

  if (!isPayableOrder(order)) {
    return err(res, id, ERROR.ORDER_NOT_ALLOWED);
  }

  const create_time = Number(time) || Date.now();
  const newTransaction = await PaymeTransaction.create({
    paymeId,
    orderId: order._id,
    amount,
    state: STATE.PENDING,
    createTime: create_time,
  });

  return ok(res, id, {
    create_time,
    transaction: newTransaction.paymeId,
    state: newTransaction.state,
  });
}

async function performTransaction(req, res) {
  const { id, params = {} } = req.body;
  const transaction = await PaymeTransaction.findOne({ paymeId: params.id });

  if (!transaction) {
    return err(res, id, ERROR.TRANSACTION_NOT_FOUND);
  }

  if (transaction.state === STATE.COMPLETED) {
    return ok(res, id, {
      perform_time: transaction.performTime,
      transaction: transaction.paymeId,
      state: transaction.state,
    });
  }

  if (transaction.state !== STATE.PENDING) {
    return err(res, id, ERROR.TRANSACTION_NOT_ALLOWED);
  }

  const order = await Order.findById(transaction.orderId);

  if (!order) {
    return err(res, id, ERROR.INVALID_ACCOUNT);
  }

  if (!isPayableOrder(order)) {
    return err(res, id, ERROR.ORDER_NOT_ALLOWED);
  }

  if (isTimedOut(transaction.createTime)) {
    await cancelTimedOutTransaction(transaction, order);
    return err(res, id, ERROR.TRANSACTION_NOT_ALLOWED);
  }

  const perform_time = Date.now();

  transaction.state = STATE.COMPLETED;
  transaction.performTime = perform_time;
  await transaction.save();

  order.paymentStatus = "PAID";
  order.status = "CONFIRMED";
  await order.save();

  return ok(res, id, {
    perform_time,
    transaction: transaction.paymeId,
    state: transaction.state,
  });
}

async function cancelTransaction(req, res) {
  const { id, params = {} } = req.body;
  const transaction = await PaymeTransaction.findOne({ paymeId: params.id });

  if (!transaction) {
    return err(res, id, ERROR.TRANSACTION_NOT_FOUND);
  }

  const order = await Order.findById(transaction.orderId);

  if (!order) {
    return err(res, id, ERROR.TRANSACTION_NOT_FOUND);
  }

  if (transaction.state === STATE.PENDING) {
    transaction.state = STATE.CANCELLED;
    transaction.cancelTime = Date.now();
    transaction.reason = params.reason;
    order.status = "CANCELLED";
    order.paymentStatus = "FAILED";
    await transaction.save();
    await order.save();

    return ok(res, id, {
      cancel_time: transaction.cancelTime,
      transaction: transaction.paymeId,
      state: STATE.CANCELLED,
    });
  }

  if (transaction.state === STATE.COMPLETED) {
    if (order.status === "DELIVERED") {
      return err(res, id, ERROR.CANT_CANCEL_TRANSACTION);
    }

    transaction.state = STATE.CANCELLED_AFTER_COMPLETE;
    transaction.cancelTime = Date.now();
    transaction.reason = params.reason;
    order.status = "CANCELLED";
    order.paymentStatus = "FAILED";
    await transaction.save();
    await order.save();

    return ok(res, id, {
      cancel_time: transaction.cancelTime,
      transaction: transaction.paymeId,
      state: STATE.CANCELLED_AFTER_COMPLETE,
    });
  }

  return ok(res, id, {
    cancel_time: transaction.cancelTime,
    transaction: transaction.paymeId,
    state: transaction.state,
  });
}

async function checkTransaction(req, res) {
  const { id, params = {} } = req.body;
  const transaction = await PaymeTransaction.findOne({ paymeId: params.id });

  if (!transaction) {
    return err(res, id, ERROR.TRANSACTION_NOT_FOUND);
  }

  return ok(res, id, {
    create_time: transaction.createTime,
    perform_time: transaction.performTime || 0,
    cancel_time: transaction.cancelTime || 0,
    transaction: transaction.paymeId,
    state: transaction.state,
    reason: transaction.reason || null,
  });
}

async function getStatement(req, res) {
  const { id, params = {} } = req.body;
  const { from, to } = params;

  const transactionsList = await PaymeTransaction.find({
    createTime: { $gte: from, $lte: to },
  });

  const transactions = transactionsList.map((transaction) => ({
    id: transaction.paymeId,
    time: transaction.createTime,
    amount: transaction.amount,
    account: {
      [ACCOUNT_KEY]: transaction.orderId.toString(),
    },
    create_time: transaction.createTime,
    perform_time: transaction.performTime || 0,
    cancel_time: transaction.cancelTime || 0,
    transaction: transaction.paymeId,
    state: transaction.state,
    reason: transaction.reason || null,
  }));

  return ok(res, id, { transactions });
}

async function paymeWebhook(req, res) {
  try {
    const { id, method } = req.body;
    console.log("[payme] webhook", {
      id,
      method,
      params: req.body?.params || null,
    });

    switch (method) {
      case "CheckPerformTransaction":
        return checkPerformTransaction(req, res);
      case "CreateTransaction":
        return createTransaction(req, res);
      case "PerformTransaction":
        return performTransaction(req, res);
      case "CancelTransaction":
        return cancelTransaction(req, res);
      case "CheckTransaction":
        return checkTransaction(req, res);
      case "GetStatement":
        return getStatement(req, res);
      default:
        console.warn("[payme] method not found", { method });
        return err(res, id, METHOD_NOT_FOUND);
    }
  } catch (error) {
    console.error("[payme] webhook error", error);
    return err(res, req.body?.id, ERROR.INTERNAL_ERROR);
  }
}

async function paymeCheckout(req, res) {
  const orderId = req.params.orderId;

  if (!isValidObjectId(orderId)) {
    return res.status(404).send("Order not found");
  }

  const order = await Order.findById(orderId);

  if (!order || !isPayableOrder(order)) {
    console.warn("[payme] checkout blocked", {
      orderId,
      exists: Boolean(order),
      paymentType: order?.paymentType,
      paymentStatus: order?.paymentStatus,
      status: order?.status,
    });
    return res.status(400).send("Payment is not allowed for this order");
  }

  res.type("html").send(buildPaymeCheckoutForm(order));
}

module.exports = {
  createTransaction,
  checkPerformTransaction,
  performTransaction,
  cancelTransaction,
  checkTransaction,
  getStatement,
  paymeWebhook,
  paymeCheckout,
};
