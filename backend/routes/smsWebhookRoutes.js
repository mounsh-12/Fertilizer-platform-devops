const express = require("express");

const router = express.Router();

const {
    receiveSmsDeliveryReport
} = require("../controllers/smsWebhookController");

// MSG91: Receive SMS delivery reports
router.post("/", receiveSmsDeliveryReport);

module.exports = router;