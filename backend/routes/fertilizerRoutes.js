
const express = require("express");
const router = express.Router();

const verifyAdmin = require("../middleware/authMiddleware");

const {
    addFertilizer,
    getAllFertilizers,
    updateFertilizer,
    updateFertilizerStatus
} = require("../controllers/fertilizerController");

const {
    bulkAddFertilizers
} = require("../controllers/bulkFertilizerController");

// All fertilizer routes require admin authentication.
router.use(verifyAdmin);

// Get all fertilizers
router.get("/", getAllFertilizers);

// Add one fertilizer
router.post("/", addFertilizer);

// Add multiple fertilizers
router.post("/bulk", bulkAddFertilizers);

// Update fertilizer details and prices
router.put("/:id", updateFertilizer);

// Activate or deactivate a fertilizer
router.patch("/:id/status", updateFertilizerStatus);

module.exports = router;
