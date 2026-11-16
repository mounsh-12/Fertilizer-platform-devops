
const express = require("express");
const router = express.Router();

const verifyAdmin = require("../middleware/authMiddleware");

const {
    createStockPurchase
} = require("../controllers/stockPurchaseController");

const {
    getAllStockPurchases,
    getStockPurchaseById
} = require("../controllers/stockPurchaseQueryController");

// Protect all stock purchase endpoints
router.use(verifyAdmin);

// Record a new stock purchase
router.post("/", createStockPurchase);

// Get all stock purchase records
router.get("/", getAllStockPurchases);

// Get one purchase with its fertilizer items
router.get("/:id", getStockPurchaseById);

module.exports = router;
