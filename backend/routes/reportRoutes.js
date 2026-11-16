
const express = require("express");
const router = express.Router();

const verifyAdmin = require("../middleware/authMiddleware");
const {
    getBusinessReports
} = require("../controllers/reportController");

// All report endpoints require admin authentication.
router.use(verifyAdmin);

// GET /api/reports?period=This%20Year
router.get("/", getBusinessReports);

module.exports = router;
