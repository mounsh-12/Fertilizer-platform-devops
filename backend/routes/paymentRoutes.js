
const express = require("express");
const router = express.Router();

const verifyAdmin = require("../middleware/authMiddleware");

const {
    getAllPayments,
    collectPayment,
    getPaymentsBySaleId
} = require("../controllers/paymentController");

// Protect all payment endpoints
router.use(verifyAdmin);

// Get all payment records
router.get("/", getAllPayments);

// Record a payment against an existing sale
router.post("/", collectPayment);

// Get payment history for a particular sale
router.get("/sale/:id", getPaymentsBySaleId);

module.exports = router;
