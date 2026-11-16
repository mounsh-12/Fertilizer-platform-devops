const express = require("express");

const router = express.Router();

const verifyAdmin = require("../middleware/authMiddleware");

const {
    retryFailedSms
} = require("../controllers/smsRetryController");

// Admin: Retry a failed invoice SMS
router.post(
    "/retry/:smsId",
    verifyAdmin,
    retryFailedSms
);

module.exports = router;