
const express = require("express");
const router = express.Router();

const verifyAdmin = require("../middleware/authMiddleware");

const {
    createSale
} = require("../controllers/salesController");

const {
    getAllSales,
    getSaleById
} = require("../controllers/salesQueryController");

// Protect all sales endpoints
router.use(verifyAdmin);

// Create a new sale
router.post("/", createSale);

// Retrieve all sales
router.get("/", getAllSales);

// Retrieve one sale with items and payments
router.get("/:id", getSaleById);

module.exports = router;
