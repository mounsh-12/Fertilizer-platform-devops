
const express = require("express");
const router = express.Router();

const verifyAdmin = require("../middleware/authMiddleware");

const {
    getInventory,
    getLowStockItems,
    updateReorderLevel,
    adjustInventory,
    getStockMovements
} = require("../controllers/inventoryController");

// Protect all inventory endpoints
router.use(verifyAdmin);

// Get complete inventory
router.get("/", getInventory);

// Get low-stock fertilizers
router.get("/low-stock", getLowStockItems);

// Update fertilizer reorder level
router.patch("/:id/reorder-level", updateReorderLevel);

// Manually adjust inventory
router.patch("/:id/adjust", adjustInventory);

// Get stock movement history for a fertilizer
router.get("/:id/movements", getStockMovements);

module.exports = router;
