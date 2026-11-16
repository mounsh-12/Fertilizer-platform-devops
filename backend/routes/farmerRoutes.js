
const express = require("express");
const router = express.Router();

const verifyAdmin = require("../middleware/authMiddleware");

const {
    addFarmer,
    getAllFarmers,
    getFarmerByMobile,
    updateFarmer,
    updateFarmerStatus
} = require("../controllers/farmerController");

// Protect all farmer endpoints
router.use(verifyAdmin);

// Register a new farmer
router.post("/", addFarmer);

// Retrieve all farmers
router.get("/", getAllFarmers);

// Find a farmer using mobile number
router.get("/mobile/:mobile", getFarmerByMobile);

// Update farmer information
router.put("/:id", updateFarmer);

// Activate or deactivate a farmer
router.patch("/:id/status", updateFarmerStatus);

module.exports = router;
