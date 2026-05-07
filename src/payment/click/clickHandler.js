const { verifyClickSign } = require("./clickService");
const clickConfig = require("../../config/click");
const Order = require("../../models/Order");
const ClickTransaction = require("../../models/ClickTransaction");

const CLICK_ERRORS = {
  SUCCESS: { code: 0, note: "Success" },
  SIGN_FAILED: { code: -1, note: "SIGN CHECK FAILED" },
  INCORRECT_AMOUNT: { code: -2, note: "Incorrect parameter amount" },
  ACTION_NOT_FOUND: { code: -3, note: "Action not found" },
  ALREADY_PAID: { code: -4, note: "Already paid" },
  ORDER_NOT_FOUND: { code: -5, note: "Order does not exist" },
  TRANSACTION_NOT_FOUND: { code: -6, note: "Transaction does not exist" },
  BAD_REQUEST: { code: -8, note: "Error in request from click" },
  CANCELLED: { code: -9, note: "Transaction cancelled" },
};

function errorResponse(clickTransId, merchantTransId, err) {
  return {
    click_trans_id: clickTransId,
    merchant_trans_id: merchantTransId,
    error: err.code,
    error_note: err.note,
  };
}

function prepareSuccess(clickTransId, merchantTransId, merchantPrepareId) {
  return {
    click_trans_id: clickTransId,
    merchant_trans_id: merchantTransId,
    merchant_prepare_id: merchantPrepareId,
    error: CLICK_ERRORS.SUCCESS.code,
    error_note: CLICK_ERRORS.SUCCESS.note,
  };
}

function completeSuccess(clickTransId, merchantTransId, merchantConfirmId) {
  return {
    click_trans_id: clickTransId,
    merchant_trans_id: merchantTransId,
    merchant_confirm_id: merchantConfirmId,
    error: CLICK_ERRORS.SUCCESS.code,
    error_note: CLICK_ERRORS.SUCCESS.note,
  };
}

function amountsEqual(clickAmount, orderAmount) {
  return Math.abs(Number(clickAmount) - Number(orderAmount)) < 0.01;
}

async function prepare(body) {
  const {
    click_trans_id,
    click_paydoc_id,
    merchant_trans_id,
    amount,
    service_id,
    action,
  } = body;

  if (String(action) !== "0") {
    return errorResponse(
      click_trans_id,
      merchant_trans_id,
      CLICK_ERRORS.ACTION_NOT_FOUND,
    );
  }

  if (String(service_id) !== String(clickConfig.serviceId)) {
    return errorResponse(
      click_trans_id,
      merchant_trans_id,
      CLICK_ERRORS.BAD_REQUEST,
    );
  }

  if (!verifyClickSign(body, "prepare")) {
    return errorResponse(
      click_trans_id,
      merchant_trans_id,
      CLICK_ERRORS.SIGN_FAILED,
    );
  }

  const order = await Order.findById(merchant_trans_id);
  if (!order) {
    return errorResponse(
      click_trans_id,
      merchant_trans_id,
      CLICK_ERRORS.ORDER_NOT_FOUND,
    );
  }

  if (!amountsEqual(amount, order.totalAmount)) {
    return errorResponse(
      click_trans_id,
      merchant_trans_id,
      CLICK_ERRORS.INCORRECT_AMOUNT,
    );
  }

  if (order.paymentStatus === "PAID") {
    return errorResponse(
      click_trans_id,
      merchant_trans_id,
      CLICK_ERRORS.ALREADY_PAID,
    );
  }

  const existingTransaction = await ClickTransaction.findOne({
    click_trans_id,
  });
  if (
    existingTransaction &&
    String(existingTransaction.merchant_trans_id) !== String(merchant_trans_id)
  ) {
    return errorResponse(
      click_trans_id,
      merchant_trans_id,
      CLICK_ERRORS.BAD_REQUEST,
    );
  }

  const merchantPrepareId = order._id.toString();

  await ClickTransaction.findOneAndUpdate(
    { click_trans_id, merchant_trans_id },
    {
      click_trans_id,
      click_paydoc_id,
      merchant_trans_id,
      merchant_prepare_id: merchantPrepareId,
      amount: Number(amount),
      service_id,
      status: "prepared",
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  await Order.findByIdAndUpdate(merchant_trans_id, {
    paymentStatus: "PENDING",
    status: "PENDING",
  });

  return prepareSuccess(click_trans_id, merchant_trans_id, merchantPrepareId);
}

async function complete(body) {
  const {
    click_trans_id,
    merchant_trans_id,
    merchant_prepare_id,
    amount,
    action,
    error: clickError,
  } = body;

  if (String(action) !== "1") {
    return errorResponse(
      click_trans_id,
      merchant_trans_id,
      CLICK_ERRORS.ACTION_NOT_FOUND,
    );
  }

  if (!verifyClickSign(body, "complete")) {
    return errorResponse(
      click_trans_id,
      merchant_trans_id,
      CLICK_ERRORS.SIGN_FAILED,
    );
  }

  const order = await Order.findById(merchant_trans_id);
  if (!order) {
    return errorResponse(
      click_trans_id,
      merchant_trans_id,
      CLICK_ERRORS.ORDER_NOT_FOUND,
    );
  }

  const transaction = await ClickTransaction.findOne({
    click_trans_id,
    merchant_trans_id,
  });
  if (!transaction) {
    return errorResponse(
      click_trans_id,
      merchant_trans_id,
      CLICK_ERRORS.TRANSACTION_NOT_FOUND,
    );
  }

  if (String(merchant_prepare_id) !== String(transaction.merchant_prepare_id)) {
    return errorResponse(
      click_trans_id,
      merchant_trans_id,
      CLICK_ERRORS.TRANSACTION_NOT_FOUND,
    );
  }

  if (!amountsEqual(amount, order.totalAmount)) {
    return errorResponse(
      click_trans_id,
      merchant_trans_id,
      CLICK_ERRORS.INCORRECT_AMOUNT,
    );
  }

  if (order.paymentStatus === "PAID") {
    return errorResponse(
      click_trans_id,
      merchant_trans_id,
      CLICK_ERRORS.ALREADY_PAID,
    );
  }

  if (Number(clickError) < 0) {
    await ClickTransaction.findByIdAndUpdate(transaction._id, {
      status: "cancelled",
    });
    await Order.findByIdAndUpdate(merchant_trans_id, {
      status: "CANCELLED",
      paymentStatus: "FAILED",
    });
    return errorResponse(
      click_trans_id,
      merchant_trans_id,
      CLICK_ERRORS.CANCELLED,
    );
  }

  await ClickTransaction.findByIdAndUpdate(transaction._id, {
    status: "paid",
    paid_at: new Date(),
  });
  await Order.findByIdAndUpdate(merchant_trans_id, {
    status: "CONFIRMED",
    paymentStatus: "PAID",
  });

  return completeSuccess(click_trans_id, merchant_trans_id, order._id.toString());
}

module.exports = { prepare, complete };
