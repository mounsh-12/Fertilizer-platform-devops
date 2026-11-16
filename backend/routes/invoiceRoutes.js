const express = require("express");

const router = express.Router();

const verifyAdmin = require("../middleware/authMiddleware");

const {
    generateInvoice
} = require("../controllers/invoiceController");

const {
    viewPublicInvoice
} = require("../controllers/publicInvoiceController");

const {
    getAllInvoices,
    revokeInvoice
} = require("../controllers/invoiceManagementController");

// Public: Farmer accesses invoice using secure token
router.get(
    "/public/:token",
    viewPublicInvoice
);

// Admin: View all generated invoices
router.get(
    "/",
    verifyAdmin,
    getAllInvoices
);

// Admin: Generate invoice for a completed sale
router.post(
    "/generate/:saleId",
    verifyAdmin,
    generateInvoice
);

// Admin: Revoke an invoice link
router.patch(
    "/:id/revoke",
    verifyAdmin,
    revokeInvoice
);

module.exports = router;