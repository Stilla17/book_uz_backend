const { verifyClickSign } = require("../payment/click/clickService");

const verifyClickMiddleware = (action) => (req, res, next) => {
  if (!verifyClickSign(req.body, action)) {
    return res.json({
      click_trans_id: req.body?.click_trans_id,
      merchant_trans_id: req.body?.merchant_trans_id,
      error: -1,
      error_note: "SIGN CHECK FAILED",
    });
  }

  next();
};

module.exports = { verifyClickMiddleware };
