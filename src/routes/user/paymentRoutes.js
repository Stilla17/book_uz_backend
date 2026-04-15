const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Click Webhook
router.post('/click/callback', paymentController.clickWebhook);

// Uzum Webhook
router.post('/uzum/callback', paymentController.uzumWebhook);

module.exports = router;