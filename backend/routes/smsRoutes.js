const express = require("express");

const router = express.Router();

const verifyAdmin = require("../middleware/authMiddleware");

const {
    getAllSmsLogs,
    getSmsLogsByInvoice
} = require("../controllers/smsController");

// Admin: View all SMS history
router.get(
    "/",
    verifyAdmin,
    getAllSmsLogs
);

// Admin: View SMS history for a particular invoice
router.get(
    "/invoice/:invoiceId",
    verifyAdmin,
    getSmsLogsByInvoice
);

module.exports = router;