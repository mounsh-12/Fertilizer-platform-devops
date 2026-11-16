const express = require("express");

const router = express.Router();

const verifyAdmin = require("../middleware/authMiddleware");

const {
    getAllFarmerCredits,
    getFarmerCreditDetails
} = require("../controllers/farmerCreditController");

// GET /api/credits/farmers
// Get credit balances of all active farmers
router.get("/farmers", verifyAdmin, getAllFarmerCredits);

// GET /api/credits/farmers/:id
// Get outstanding invoices for a specific farmer
router.get("/farmers/:id", verifyAdmin, getFarmerCreditDetails);

module.exports = router;