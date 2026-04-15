const paymentService = require('../services/paymentService');

const clickWebhook = async (req, res) => {
  const result = await paymentService.handleClickCallback(req.body);
  res.json(result);
};

const uzumWebhook = async (req, res) => {
  try {
    const result = await paymentService.handleUzumCallback(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = { clickWebhook, uzumWebhook };